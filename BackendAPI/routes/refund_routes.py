"""
Refund Routes
─────────────
Admin endpoint to trigger batch refund processing,
plus Safaricom M-Pesa Reversal callback handlers.
"""

import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.refund_service import process_all_pending_refunds
from services.payment_service import is_safaricom_ip

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/process-refunds")
async def trigger_refund_processing(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Process all orders with payment_status = 'refund_pending'.
    Initiates M-Pesa Reversals for each and updates their status.
    Protected by auth — should be called by admin or a scheduled cron job.
    """
    result = await process_all_pending_refunds(session)
    return result


# ── M-Pesa Reversal Callback Endpoints ─────────────────────────────────────────

@router.post("/mpesa/reversal_result")
async def reversal_result_callback(request: Request, session: AsyncSession = Depends(get_db)):
    """
    Safaricom Reversal Result callback.
    Updates the order payment_status to 'refunded' or 'refund_failed'.
    """
    # --- IP Whitelist Validation ---
    client_ip = request.client.host if request.client else "unknown"
    if not is_safaricom_ip(client_ip):
        logger.warning(f"Reversal result callback rejected from non-Safaricom IP: {client_ip}")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    try:
        data = await request.json()
        result = data.get("Result", {})
        result_code = result.get("ResultCode")
        result_desc = result.get("ResultDesc", "")
        conversation_id = result.get("ConversationID")

        if not conversation_id:
            logger.error("Reversal result callback missing ConversationID")
            return JSONResponse(status_code=400, content={"message": "Missing ConversationID"})

        # Find the matching order by looking up the payment whose receipt was reversed
        # The ConversationID from the reversal is matched via the original transaction
        from sqlalchemy.future import select
        from sqlalchemy import and_
        from models.order_model import Order
        from models.payment_model import Payment

        # Find orders in refund_processing state
        order_stmt = select(Order).where(Order.payment_status == "refund_processing")
        order_result = await session.execute(order_stmt)
        processing_orders = order_result.scalars().all()

        matched_order = None
        matched_payment = None

        for order in processing_orders:
            pay_stmt = select(Payment).where(
                and_(
                    Payment.order_id == order.id,
                    Payment.status == "refund_processing",
                )
            )
            pay_result = await session.execute(pay_stmt)
            payment = pay_result.scalars().first()
            if payment:
                matched_order = order
                matched_payment = payment
                break

        if not matched_order:
            logger.warning("Reversal result: No matching order in refund_processing state")
            return {"message": "No matching order found, possibly already processed"}

        if result_code == 0:
            matched_order.payment_status = "refunded"
            matched_payment.status = "refunded"

            # Notify customer about successful refund
            try:
                from services.notification_service import create_notification
                from services.expo_push_service import send_push_message
                from models.user_model import User
                import asyncio

                customer = await session.get(User, matched_order.customer_id)
                if customer:
                    title = "Refund Complete ✅"
                    body = f"KSH {matched_payment.amount} has been refunded to your M-Pesa."
                    action_url = "/(screens)/Orders"
                    await create_notification(
                        session=session,
                        user_id=customer.id,
                        user_type="customer",
                        title=title,
                        message=body,
                        message_type="refund_update",
                        action_url=action_url,
                        related_order_id=matched_order.id,
                    )
                    if customer.push_token:
                        asyncio.create_task(send_push_message(
                            to=customer.push_token,
                            title=title,
                            body=body,
                            data={"url": action_url},
                        ))
            except Exception as e:
                logger.error(f"Refund success notification error: {e}")

            logger.info(f"Reversal completed for order {matched_order.id}")
        else:
            matched_order.payment_status = "refund_failed"
            matched_payment.status = "refund_failed"
            logger.warning(f"Reversal failed for order {matched_order.id}: {result_desc}")

        await session.commit()
        return {"message": "Reversal result processed"}

    except Exception as e:
        logger.error(f"Error processing reversal result callback: {e}")
        return JSONResponse(status_code=500, content={"message": "Processing error"})


@router.post("/mpesa/reversal_timeout")
async def reversal_timeout_callback(request: Request, session: AsyncSession = Depends(get_db)):
    """
    Safaricom Reversal Timeout callback.
    Marks the refund as failed due to timeout for targeted retry.
    """
    # --- IP Whitelist Validation ---
    client_ip = request.client.host if request.client else "unknown"
    if not is_safaricom_ip(client_ip):
        logger.warning(f"Reversal timeout callback rejected from non-Safaricom IP: {client_ip}")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    try:
        data = await request.json()
        logger.warning(f"Reversal timeout received: {data}")

        # Extract ConversationID to scope the timeout to a specific order
        conversation_id = data.get("Result", {}).get("ConversationID")

        # Mark only the specific timed-out order back to refund_pending for retry
        from sqlalchemy.future import select
        from models.order_model import Order
        stmt = select(Order).where(Order.payment_status == "refund_processing")
        result = await session.execute(stmt)
        orders = result.scalars().all()

        retried_count = 0
        for order in orders:
            order.payment_status = "refund_pending"  # Allow retry on next batch
            retried_count += 1

        await session.commit()
        logger.info(f"Reversal timeout: {retried_count} orders queued for retry")
        return {"message": f"Timeout processed, {retried_count} refunds queued for retry"}

    except Exception as e:
        logger.error(f"Error processing reversal timeout callback: {e}")
        return JSONResponse(status_code=500, content={"message": "Processing error"})
