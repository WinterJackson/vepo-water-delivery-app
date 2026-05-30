import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from sqlalchemy.sql.expression import text
from dependencies.dependencies import get_db_session
from models.order_model import Order, OrderItem
from models.product_model import Product
from models.vendor_model import Vendor
from services.expo_push_service import send_push_message
from services.notification_service import create_notification
from routes.websocket_routes import manager

logger = logging.getLogger(__name__)

async def _restore_order_stock(session: AsyncSession, order: Order):
    """Atomically restore product stock for all items in an auto-cancelled order."""
    items_q = select(OrderItem).where(OrderItem.order_id == order.id)
    result = await session.execute(items_q)
    items = result.scalars().all()

    for item in items:
        await session.execute(
            update(Product)
            .where(Product.id == item.product_id)
            .values(
                stock=Product.stock + item.quantity,
                is_available=True
            )
        )
    if items:
        logger.info(f"Restored stock for {len(items)} items from auto-cancelled order {order.id}")

async def run_auto_cancel_orders():
    """
    Cronjob to auto-cancel pending orders that have not been accepted within 15 minutes.
    """
    logger.info("Running auto-cancel pending orders job...")
    
    async with get_db_session() as session:
        # Find orders that are 'pending' and older than 15 minutes
        query = select(Order).where(
            and_(
                Order.order_status == "pending",
                func.now() - Order.created_at > text("INTERVAL '15 minutes'")
            )
        )
        result = await session.execute(query)
        stale_orders = result.scalars().all()
        
        if not stale_orders:
            logger.info("No stale pending orders found.")
            return

        for order in stale_orders:
            logger.info(f"Auto-cancelling order {order.id} due to SLA breach (15 minutes).")
            
            order.order_status = "cancelled"
            
            # Flag paid orders for refund
            if order.payment_status == "paid":
                order.payment_status = "refund_pending"
                order.commission_lost = order.platform_total

            await _restore_order_stock(session, order)
            
            # Notify Customer
            customer = await session.get(User, order.customer_id)
            if customer:
                c_title = "Order Cancelled 🚫"
                c_body = f"Your order #{str(order.id)[:8]} was cancelled because the vendor did not accept it in time. Any payments will be refunded."
                c_action = f"/(screens)/OrderDetail/{order.id}"
                
                await create_notification(
                    session=session, user_id=customer.id, user_type="customer",
                    title=c_title, message=c_body, message_type="order_update", action_url=c_action, related_order_id=order.id
                )
                if customer.push_token:
                    asyncio.create_task(send_push_message(to=customer.push_token, title=c_title, body=c_body, data={"url": c_action}))
            
            # Notify Vendor
            vendor = await session.get(Vendor, order.vendor_id)
            if vendor:
                v_title = "Order Missed SLA ⚠️"
                v_body = f"Order #{str(order.id)[:8]} was auto-cancelled for missing the 15-minute acceptance window."
                v_action = f"/(screens)/OrderDetail/{order.id}"
                
                await create_notification(
                    session=session, user_id=vendor.id, user_type="vendor",
                    title=v_title, message=v_body, message_type="system_alert", action_url=v_action, related_order_id=order.id
                )
                if vendor.push_token:
                    asyncio.create_task(send_push_message(to=vendor.push_token, title=v_title, body=v_body, data={"url": v_action}))

            # Broadcast WS Update
            try:
                await manager.broadcast_order_update(
                    vendor_id=str(order.vendor_id),
                    customer_id=str(order.customer_id),
                    deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
                    payload={"action": "ORDER_STATUS_UPDATE", "order_id": str(order.id), "status": "cancelled"}
                )
            except Exception as e:
                logger.error(f"WS Broadcast fail in auto_cancel_orders: {e}")

        await session.commit()
    logger.info(f"Auto-cancel job finished. Cancelled {len(stale_orders)} orders.")

if __name__ == "__main__":
    asyncio.run(run_auto_cancel_orders())
