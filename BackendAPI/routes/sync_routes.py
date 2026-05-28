from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone
import logging
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from models.order_model import Order
from models.deliverer_model import Deliverer

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/rider/orders")
async def sync_rider_orders(
    since: datetime = Query(None, description="ISO Timestamp of last sync"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    clerk_id = user["sub"]
    result = await db.execute(select(Deliverer).where(Deliverer.clerk_id == clerk_id))
    deliverer = result.scalars().first()
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    query = select(Order).where(Order.deliverer_id == deliverer.id)
    if since:
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
        query = query.filter(Order.updated_at >= since)
        
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return [
       {
           "id": str(o.id),
           "vendor_id": str(o.vendor_id),
           "customer_id": str(o.customer_id),
           "delivery_address": o.delivery_address,
           "phone": o.phone,
           "lat_from": o.lat_from,
           "lng_from": o.lng_from,
           "lat": o.lat,
           "lng": o.lng,
           "total_amount": float(o.total_amount),
           "order_status": o.order_status,
           "payment_status": o.payment_status,
           "delivery_fee": float(o.delivery_fee) if o.delivery_fee else 0.0,
           "updated_at": o.updated_at.isoformat() if o.updated_at else None
       } for o in orders
    ]
