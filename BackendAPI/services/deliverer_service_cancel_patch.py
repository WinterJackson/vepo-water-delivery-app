from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from models.order_model import Order, OrderItem
from models.user_model import User
from models.vendor_model import Vendor
from models.product_model import Product
from sqlalchemy import select, update
import asyncio
import logging

logger = logging.getLogger(__name__)

async def cancel_delivery(session: AsyncSession, clerk_id: str, order_id: str, reason: str, details: str = None):
    """
    Handles a Rider cancelling/rejecting an order.
    Depending on the state and reason, this will either:
    1. Unassign the rider and dispatch to a new rider.
    2. Cancel the order entirely.
    """
    from services.deliverer_service import get_deliverer_by_clerk_id
    from services.notification_service import create_notification
    from services.push_notification_service import send_push_message
    
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider account not found.")

    order = await session.get(Order, order_id)
    if not order or order.deliverer_id != deliverer.id:
        raise HTTPException(status_code=404, detail="This order is not assigned to you.")

    # Matrix of reasons
    vendor_fault_reasons = ["vendor_closed", "out_of_stock"]
    rider_fault_reasons = ["vehicle_issue", "accident", "other"]
    post_pickup_reasons = ["vehicle_issue", "accident", "customer_unreachable", "customer_refused", "other"]

    previous_rider_id = order.deliverer_id
    action_taken = ""

    if order.order_status in ["pending", "accepted", "preparing", "ready"]:
        if reason in vendor_fault_reasons:
            action_taken = "cancelled"
        else:
            action_taken = "unassigned"
    elif order.order_status == "in_transit":
        action_taken = "cancelled"
    else:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in state {order.order_status}")

    order.cancellation_reason = f"{reason}: {details}" if details else reason

    if action_taken == "unassigned":
        order.deliverer_id = None
        order.order_status = "unassigned"
        deliverer.is_available = True
    else:
        # action_taken == "cancelled"
        order.order_status = "cancelled"
        deliverer.is_available = True
        
        # Restore stock
        items_q = select(OrderItem).where(OrderItem.order_id == order.id)
        result = await session.execute(items_q)
        items = result.scalars().all()
        for item in items:
            await session.execute(
                update(Product)
                .where(Product.id == item.product_id)
                .values(stock=Product.stock + item.quantity, is_available=True)
            )

        # Flag paid orders for refund
        if order.payment_status == "paid":
            order.payment_status = "refund_pending"
            order.commission_lost = order.platform_total

    await session.commit()

    # WebSockets
    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(previous_rider_id) if previous_rider_id else "",
            payload={
                "action": "ORDER_STATUS_UPDATE",
                "order_id": str(order.id),
                "status": action_taken,
                "reason": "rider_cancelled",
            }
        )
    except Exception as e:
        logger.error(f"WS Broadcast fail in cancel_delivery: {e}")

    # Notifications
    if action_taken == "unassigned":
        # Same as reject_delivery
        vendor = await session.get(Vendor, order.vendor_id)
        if vendor:
            title = "Rider Issue 🔄"
            body = f"Rider reported an issue ({reason}). Finding a new rider."
            action_url = "/(screens)/Orders"
            await create_notification(session=session, user_id=vendor.id, user_type="vendor", title=title, message=body, message_type="delivery_update", action_url=action_url, related_order_id=order.id)
            if vendor.push_token:
                asyncio.create_task(send_push_message(to=vendor.push_token, title=title, body=body, data={"url": action_url}))
        
        customer = await session.get(User, order.customer_id)
        if customer:
            title = "Finding a New Rider 🔄"
            body = "Your previous rider had an issue. We are dispatching a new rider!"
            action_url = "/(screens)/Orders"
            await create_notification(session=session, user_id=customer.id, user_type="customer", title=title, message=body, message_type="delivery_update", action_url=action_url, related_order_id=order.id)
            if customer.push_token:
                asyncio.create_task(send_push_message(to=customer.push_token, title=title, body=body, data={"url": action_url}))
    else:
        # action_taken == "cancelled"
        vendor = await session.get(Vendor, order.vendor_id)
        if vendor:
            title = "Delivery Cancelled ❌"
            body = f"Rider cancelled the delivery. Reason: {reason}."
            if order.order_status == "cancelled" and reason not in vendor_fault_reasons:
                body += " The rider must return the goods to you."
            action_url = "/(screens)/Orders"
            await create_notification(session=session, user_id=vendor.id, user_type="vendor", title=title, message=body, message_type="order_cancelled", action_url=action_url, related_order_id=order.id)
            if vendor.push_token:
                asyncio.create_task(send_push_message(to=vendor.push_token, title=title, body=body, data={"url": action_url}))
        
        customer = await session.get(User, order.customer_id)
        if customer:
            title = "Delivery Cancelled ❌"
            body = "We are sorry, but your delivery was cancelled due to an issue."
            if order.payment_status == "refund_pending":
                body += " Your refund will be processed shortly."
            action_url = "/(screens)/Orders"
            await create_notification(session=session, user_id=customer.id, user_type="customer", title=title, message=body, message_type="order_cancelled", action_url=action_url, related_order_id=order.id)
            if customer.push_token:
                asyncio.create_task(send_push_message(to=customer.push_token, title=title, body=body, data={"url": action_url}))

    return {"message": "Cancellation processed", "action_taken": action_taken, "order_id": str(order.id)}

