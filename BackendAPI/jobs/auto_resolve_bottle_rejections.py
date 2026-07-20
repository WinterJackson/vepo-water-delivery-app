import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_
from dependencies.dependencies import get_db_session
from models.bottle_rejection_model import BottleRejectionTicket, RejectionStatus
from models.order_model import Order
from services.vendor_management_service import _restore_order_stock
from routes.websocket_routes import manager

logger = logging.getLogger(__name__)

async def run_auto_resolve_bottle_rejections():
    """Cronjob: auto-approve any bottle-rejection ticket still PENDING_REVIEW after 3 minutes."""
    logger.info("Running bottle-rejection timeout sweep...")
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=3)

    async with get_db_session() as session:
        query = select(BottleRejectionTicket).where(
            and_(
                BottleRejectionTicket.status == RejectionStatus.PENDING_REVIEW,
                BottleRejectionTicket.created_at <= cutoff,
            )
        )
        stale_tickets = (await session.execute(query)).scalars().all()
        if not stale_tickets:
            return

        for rejection in stale_tickets:
            rejection.status = RejectionStatus.APPROVED
            rejection.admin_notes = "Auto-approved due to timeout. Order cancelled."

            order = await session.get(Order, rejection.order_id)
            if order and order.order_status == "pending_review":
                order.order_status = "cancelled"
                if order.payment_status == "paid":
                    order.payment_status = "refund_pending"
                    order.commission_lost = order.platform_total
                await _restore_order_stock(session, order)

                try:
                    await manager.broadcast_order_update(
                        vendor_id=str(order.vendor_id),
                        customer_id=str(order.customer_id),
                        deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
                        payload={
                            "action": "ORDER_STATUS_UPDATE", "order_id": str(order.id), "status": "cancelled",
                            "message": "Order cancelled because your empty bottle did not pass inspection."
                        }
                    )
                except Exception as e:
                    logger.error(f"WS broadcast fail in bottle-rejection sweep: {e}")

        await session.commit()
        logger.info(f"Auto-resolved {len(stale_tickets)} stale bottle-rejection ticket(s).")
