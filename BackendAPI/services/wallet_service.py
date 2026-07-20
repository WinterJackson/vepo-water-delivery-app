import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
from fastapi import HTTPException
from models.wallet_transaction_model import WalletTransaction, UserType, TransactionType, TransactionStatus
from models.user_model import User
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from services.payment_service import initiate_stk_push, initiate_b2c_payout

logger = logging.getLogger(__name__)

async def initiate_wallet_topup(session: AsyncSession, user_id: str, user_type: str, amount: float, phone: str):
    if amount < 10:
        raise HTTPException(status_code=400, detail="Minimum top-up amount is 10 KSH.")
        
    # Trigger M-Pesa STK Push
    response = await initiate_stk_push(phone=phone, amount=int(amount))
    if "error" in response or response.get("ResponseCode") != "0":
        logger.error(f"STK Push Failed: {response}")
        raise HTTPException(status_code=400, detail="Failed to initiate STK push. Please try again.")

    checkout_request_id = response.get("CheckoutRequestID")

    # Log pending transaction
    transaction = WalletTransaction(
        user_id=user_id,
        user_type=UserType[user_type.lower()],
        transaction_type=TransactionType.top_up,
        amount=amount,
        status=TransactionStatus.pending,
        reference_id=checkout_request_id,
        description="M-Pesa STK Push Top Up"
    )
    session.add(transaction)
    await session.commit()
    
    return {"message": "STK Push initiated", "checkout_request_id": checkout_request_id}

async def handle_mpesa_topup_callback(session: AsyncSession, payload: dict):
    stk_callback = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")
    
    if not checkout_request_id:
        return {"status": "ignored"}
        
    # Find pending transaction
    result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.reference_id == checkout_request_id)
        .where(WalletTransaction.status == TransactionStatus.pending)
    )
    transaction = result.scalars().first()
    
    if not transaction:
        logger.warning(f"No pending transaction found for CheckoutRequestID {checkout_request_id}")
        return {"status": "not_found"}

    if result_code == 0:
        # Success
        callback_metadata = stk_callback.get("CallbackMetadata", {}).get("Item", [])
        mpesa_receipt = next((item.get("Value") for item in callback_metadata if item.get("Name") == "MpesaReceiptNumber"), None)
        
        transaction.status = TransactionStatus.completed
        transaction.mpesa_receipt_number = mpesa_receipt
        
        # Credit user wallet
        if transaction.user_type == UserType.vendor:
            user_res = await session.execute(select(Vendor).where(Vendor.clerk_id == transaction.user_id).with_for_update())
            user = user_res.scalars().first()
            if user: user.wallet_balance = float(user.wallet_balance or 0) + float(transaction.amount)
        elif transaction.user_type == UserType.rider:
            user_res = await session.execute(select(Deliverer).where(Deliverer.clerk_id == transaction.user_id).with_for_update())
            user = user_res.scalars().first()
            if user: user.wallet_balance = float(user.wallet_balance or 0) + float(transaction.amount)
        elif transaction.user_type == UserType.customer:
            user_res = await session.execute(select(User).where(User.clerk_id == transaction.user_id).with_for_update())
            user = user_res.scalars().first()
            if user: user.wallet_balance = float(user.wallet_balance or 0) + float(transaction.amount)
            
        await session.commit()
        return {"status": "success"}
    else:
        # Failed
        transaction.status = TransactionStatus.failed
        transaction.failure_reason = stk_callback.get("ResultDesc")
        await session.commit()
        return {"status": "failed"}

async def initiate_wallet_withdrawal(session: AsyncSession, user_id: str, user_type: str, amount: float, phone: str):
    import re
    if amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is 500 KSH.")

    if not re.match(r"^254[17]\d{8}$", phone):
        raise HTTPException(status_code=400, detail="Phone number must be in the format 2547XXXXXXXX or 2541XXXXXXXX.")

    model_map = {"vendor": Vendor, "rider": Deliverer, "customer": User}
    model = model_map.get(user_type.lower())
    if model is None:
        raise HTTPException(status_code=400, detail="Invalid user_type for withdrawal.")

    # Lock the row for the duration of this transaction to prevent concurrent double-withdrawal
    result = await session.execute(select(model).where(model.clerk_id == user_id).with_for_update())
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    current_balance = float(user.wallet_balance or 0)
    if current_balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")

    transaction_fee = 15.0
    if user_type.lower() == "vendor":
        threshold = 5000.0 if getattr(user, "vendor_type", "") == "wholesale_b2b" else 2500.0
        if current_balance >= threshold:
            transaction_fee = 0.0
    elif user_type.lower() == "rider":
        if current_balance >= 1000.0:
            transaction_fee = 0.0
    elif user_type.lower() == "customer":
        transaction_fee = 0.0

    if amount <= transaction_fee:
        raise HTTPException(status_code=400, detail=f"Withdrawal amount must be greater than network fee (KSH {transaction_fee}).")

    user.wallet_balance = current_balance - amount
    disbursement_amount = amount - transaction_fee

    transaction = WalletTransaction(
        user_id=user_id,
        user_type=UserType[user_type.lower()],
        transaction_type=TransactionType.withdrawal,
        amount=amount,
        status=TransactionStatus.pending,
        description=f"M-Pesa B2C Withdrawal (Net: {disbursement_amount}, Fee: {transaction_fee})",
    )
    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)

    response = await initiate_b2c_payout(phone=phone, amount=disbursement_amount, payout_id=str(transaction.id))

    if not response.get("success"):
        # Re-fetch and lock again — never trust the stale `current_balance` closure on revert,
        # since another transaction may have touched this wallet in the meantime.
        result = await session.execute(select(model).where(model.clerk_id == user_id).with_for_update())
        fresh_user = result.scalars().first()
        fresh_user.wallet_balance = float(fresh_user.wallet_balance or 0) + amount
        transaction.status = TransactionStatus.failed
        transaction.failure_reason = response.get("error")
        await session.commit()
        raise HTTPException(status_code=400, detail=response.get("error", "Withdrawal failed"))

    # Safaricom has only ACCEPTED the request into its queue here — real confirmation
    # arrives asynchronously via the B2C result callback. Do NOT mark completed yet.
    transaction.reference_id = response.get("ConversationID")
    transaction.status = TransactionStatus.processing
    await session.commit()

    return {"message": "Withdrawal is processing and will complete shortly", "transaction": transaction}

async def get_wallet_transactions(session: AsyncSession, user_id: str, limit: int = 50, offset: int = 0, search: str = None, transaction_type: str = None):
    query = select(WalletTransaction).where(WalletTransaction.user_id == user_id)
    
    if search:
        query = query.where(
            or_(
                WalletTransaction.mpesa_receipt_number.ilike(f"%{search}%"),
                WalletTransaction.reference_id.ilike(f"%{search}%"),
                WalletTransaction.description.ilike(f"%{search}%")
            )
        )
        
    if transaction_type and transaction_type != "All":
        query = query.where(WalletTransaction.transaction_type == transaction_type)
        
    total_query = select(func.count()).select_from(query.subquery())
    total_count = (await session.execute(total_query)).scalar() or 0
    
    result = await session.execute(
        query.order_by(WalletTransaction.created_at.desc())
        .limit(limit).offset(offset)
    )
    
    transactions = result.scalars().all()
    
    return {
        "data": transactions,
        "nextCursor": offset + limit if (offset + limit) < total_count else None,
        "hasNextPage": (offset + limit) < total_count,
        "total": total_count
    }
