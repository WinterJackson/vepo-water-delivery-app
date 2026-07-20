import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from schemas.payout_schemas import PayoutCreate, PayoutResponse
from services.payout_service import request_payout, get_provider_payouts
from services.payment_service import is_safaricom_ip

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/request", response_model=PayoutResponse)
async def create_payout_request(
    data: PayoutCreate,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Submit a withdrawal/cashout request with automatic M-Pesa B2C disbursement."""
    clerk_id = user["sub"]
    return await request_payout(session, clerk_id, data)


@router.get("/")
async def fetch_payouts(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Fetch balance metrics and payout history for the authenticated provider."""
    clerk_id = user["sub"]
    return await get_provider_payouts(session, clerk_id)


# ── M-Pesa B2C Callback Endpoints ─────────────────────────────────────────────
# These are called by Safaricom servers when a B2C transaction completes or times out.

async def _reconcile_wallet_transaction(session, conversation_id: str, success: bool, result_desc: str, mpesa_receipt: str | None):
    from sqlalchemy.future import select
    from models.wallet_transaction_model import WalletTransaction, TransactionStatus, UserType
    from models.user_model import User
    from models.vendor_model import Vendor
    from models.deliverer_model import Deliverer

    stmt = select(WalletTransaction).where(
        WalletTransaction.reference_id == conversation_id,
        WalletTransaction.status == TransactionStatus.processing,
    ).with_for_update()
    tx = (await session.execute(stmt)).scalars().first()
    if not tx:
        return False  # not ours — let the Payout-table lookup handle it

    if success:
        tx.status = TransactionStatus.completed
        tx.mpesa_receipt_number = mpesa_receipt
    else:
        # Real payout failed after we'd already deducted the wallet balance — refund it now.
        model = {"vendor": Vendor, "rider": Deliverer, "customer": User}[tx.user_type.value]
        result = await session.execute(select(model).where(model.clerk_id == tx.user_id).with_for_update())
        user = result.scalars().first()
        if user:
            user.wallet_balance = float(user.wallet_balance or 0) + float(tx.amount)
        tx.status = TransactionStatus.failed
        tx.failure_reason = result_desc

    await session.commit()
    return True


@router.post("/mpesa/b2c_result")
async def b2c_result_callback(request: Request, session: AsyncSession = Depends(get_db)):
    """
    Safaricom B2C Result callback.
    Updates the Payout record to 'completed' or 'failed' based on the result.
    """
    # --- IP Whitelist Validation ---
    client_ip = request.client.host if request.client else "unknown"
    if not is_safaricom_ip(client_ip):
        logger.warning(f"B2C result callback rejected from non-Safaricom IP: {client_ip}")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    try:
        data = await request.json()
        result = data.get("Result", {})
        result_code = result.get("ResultCode")
        conversation_id = result.get("ConversationID")
        result_desc = result.get("ResultDesc", "")

        if not conversation_id:
            logger.error("B2C result callback missing ConversationID")
            return JSONResponse(status_code=400, content={"message": "Missing ConversationID"})
            
        handled = await _reconcile_wallet_transaction(session, conversation_id, result_code == 0, result_desc, mpesa_receipt=None)
        if handled:
            return {"message": "Wallet transaction reconciled"}

        # Find the payout record by ConversationID
        from sqlalchemy.future import select
        from models.payout_model import Payout
        stmt = select(Payout).where(Payout.conversation_id == conversation_id)
        result_row = await session.execute(stmt)
        payout = result_row.scalars().first()

        if not payout:
            logger.error(f"B2C result: No payout found for ConversationID {conversation_id}")
            return JSONResponse(status_code=404, content={"message": "Payout not found"})

        if result_code == 0:
            # Extract receipt number from ResultParameters
            payout.status = "completed"
            params = result.get("ResultParameters", {}).get("ResultParameter", [])
            for param in params:
                if param.get("Key") == "TransactionReceipt":
                    payout.mpesa_receipt = param.get("Value")
                    break

            # Notify provider about successful payout
            try:
                from services.notification_service import create_notification
                await create_notification(
                    session=session,
                    user_id=payout.provider_id,
                    user_type=payout.provider_type,
                    title="Payout Successful ✅",
                    message=f"KSH {payout.amount} has been sent to your M-Pesa.",
                    message_type="payout_update",
                    action_url="/(screens)/Cashout",
                )
            except Exception as e:
                logger.error(f"B2C success notification failed: {e}")

            logger.info(f"B2C payout {payout.id} completed. Receipt: {payout.mpesa_receipt}")
        else:
            payout.status = "failed"
            payout.failure_reason = result_desc

            # Notify provider about failed payout
            try:
                from services.notification_service import create_notification
                await create_notification(
                    session=session,
                    user_id=payout.provider_id,
                    user_type=payout.provider_type,
                    title="Payout Failed ❌",
                    message=f"Your payout of KSH {payout.amount} failed: {result_desc}",
                    message_type="payout_update",
                    action_url="/(screens)/Cashout",
                )
            except Exception as e:
                logger.error(f"B2C failure notification failed: {e}")

            logger.warning(f"B2C payout {payout.id} failed: {result_desc}")

        await session.commit()
        return {"message": "B2C result processed"}

    except Exception as e:
        logger.error(f"Error processing B2C result callback: {e}")
        return JSONResponse(status_code=500, content={"message": "Processing error"})


@router.post("/mpesa/b2c_timeout")
async def b2c_timeout_callback(request: Request, session: AsyncSession = Depends(get_db)):
    """
    Safaricom B2C Timeout callback.
    Marks the payout as failed due to timeout if it hasn't already been resolved.
    """
    # --- IP Whitelist Validation ---
    client_ip = request.client.host if request.client else "unknown"
    if not is_safaricom_ip(client_ip):
        logger.warning(f"B2C timeout callback rejected from non-Safaricom IP: {client_ip}")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    try:
        data = await request.json()
        conversation_id = data.get("Result", {}).get("ConversationID")

        if conversation_id:
            handled = await _reconcile_wallet_transaction(session, conversation_id, success=False, result_desc="M-Pesa B2C request timed out", mpesa_receipt=None)
            if handled:
                return {"message": "Wallet transaction timeout reconciled"}

            from sqlalchemy.future import select
            from models.payout_model import Payout
            stmt = select(Payout).where(Payout.conversation_id == conversation_id)
            result_row = await session.execute(stmt)
            payout = result_row.scalars().first()

            if payout and payout.status == "processing":
                payout.status = "failed"
                payout.failure_reason = "M-Pesa B2C request timed out"
                await session.commit()
                logger.warning(f"B2C payout {payout.id} timed out")

        return {"message": "Timeout processed"}

    except Exception as e:
        logger.error(f"Error processing B2C timeout callback: {e}")
        return JSONResponse(status_code=500, content={"message": "Processing error"})
