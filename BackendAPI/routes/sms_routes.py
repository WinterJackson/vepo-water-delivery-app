from fastapi import APIRouter, Form, Request
from sqlalchemy.future import select
from models.deliverer_model import Deliverer
from models.order_model import Order
from db.session import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

from core.redis_client import redis_limiter as limiter

@router.post("/webhook")
@limiter.limit("5/minute")
async def process_sms_webhook(request: Request, From: str = Form(...), Body: str = Form(...)):
    """
    Parses incoming SMS payloads from telecommunication hooks.
    Format expected: "DELIVERED <order_id_first_8_chars>"
    """
    logger.info(f"Received SMS Webhook from {From}: {Body}")
    body_clean = Body.strip().upper()
    
    if not body_clean.startswith("DELIVERED"):
        return {"status": "ignored", "message": "unrecognized command"}
    
    parts = body_clean.split()
    if len(parts) < 2:
        return {"status": "error", "message": "invalid format"}
        
    order_suffix = parts[1].lower()
    
    # Open isolated database session natively specifically for external webhooks
    async with AsyncSessionLocal() as session:
        # Match Deliverer globally based on generic phone suffix bounds preventing country code clashes
        phone_suffix = From[-9:] 
        stmt = select(Deliverer).where(Deliverer.phone_number.like(f"%{phone_suffix}%"))
        result = await session.execute(stmt)
        deliverer = result.scalars().first()
        
        if not deliverer:
            logger.warning(f"SMS Webhook: Unrecognized deliverer phone {From}")
            return {"status": "error", "message": "unauthorized sender"}

        # BUG-SMS-02 FIX: Match active string identifiers on order UUIDs utilizing text() for correct index usage
        from sqlalchemy import text
        stmt_order = select(Order).where(
            Order.deliverer_id == deliverer.id,
            Order.order_status.in_(["picked_up", "in_transit"]),
            text("CAST(id AS TEXT) LIKE :prefix")
        ).params(prefix=f"{order_suffix}%")
        result_order = await session.execute(stmt_order)
        order = result_order.scalars().first()
        
        if not order:
            logger.warning(f"SMS Webhook: Unrecognized order {order_suffix} for {deliverer.name}")
            return {"status": "error", "message": "order not found"}
            
        # BUG-SMS-01 FIX: Apply validate_status_transition state machine guard
        from services.order_service import validate_status_transition
        if not validate_status_transition(order.order_status, "delivered"):
            logger.warning(f"SMS Webhook: Invalid state transition for {order.id} from {order.order_status} to delivered")
            return {"status": "error", "message": "invalid state transition"}

        order.order_status = "delivered"
        await session.commit()
        
        # Broadcast real-time order status update via WebSocket for SMS completion
        try:
            from routes.websocket_routes import manager
            await manager.broadcast_order_update(
                vendor_id=str(order.vendor_id),
                customer_id=str(order.customer_id),
                deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
                payload={"action": "ORDER_STATUS_UPDATE", "order_id": str(order.id), "status": "delivered"}
            )
        except Exception as e:
            logger.error(f"WS Broadcast fail in SMS webhook: {e}")
        
        logger.info(f"SMS Webhook: Order {order.id} delivered via pure GSM fallback logic successfully!")
        
        return {"status": "success", "message": f"Order {order_suffix} marked as delivered"}
