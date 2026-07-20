from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from models.review_model import Review
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from schemas.review_schemas import ReviewCreate

from fastapi import HTTPException
from models.order_model import Order

async def create_review(session: AsyncSession, clerk_id: str, data: ReviewCreate):
    # Fetch the order to ensure it belongs to the reviewing customer
    order = await session.get(Order, data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    from models.user_model import User
    user = await session.get(User, order.customer_id) if hasattr(order, 'customer_id') else await session.get(User, order.user_id)
    if not user or user.clerk_id != clerk_id:
        raise HTTPException(status_code=403, detail="You can only review orders you have placed.")
        
    if order.order_status != "delivered":
        raise HTTPException(status_code=400, detail="You can only review orders that have been delivered.")

    # Anti-Fraud: Target Match and Self-Rating Prevention
    if data.target_type == 'vendor':
        if order.vendor_id is None or str(order.vendor_id) != str(data.target_id):
            raise HTTPException(status_code=403, detail="You can only review the vendor who fulfilled this order.")
        target = await session.get(Vendor, data.target_id)
        if target and (target.clerk_id == clerk_id or target.staff_clerk_id == clerk_id):
            raise HTTPException(status_code=403, detail="Self-rating prohibited. You cannot review your own store.")
    elif data.target_type == 'rider':
        if order.deliverer_id is None or str(order.deliverer_id) != str(data.target_id):
            raise HTTPException(status_code=403, detail="You can only review the rider who delivered this order.")
        target = await session.get(Deliverer, data.target_id)
        if target and target.clerk_id == clerk_id:
            raise HTTPException(status_code=403, detail="Self-rating prohibited. You cannot review your own rider profile.")
    else:
        target = None

    # Create the review record
    review = Review(
        order_id=data.order_id,
        customer_clerk_id=clerk_id,
        target_type=data.target_type,
        target_id=data.target_id,
        rating=data.rating,
        comment=data.comment
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)

    # Recalculate average rating for the target
    avg_query = select(func.avg(Review.rating)).where(
        Review.target_id == data.target_id,
        Review.target_type == data.target_type
    )
    avg_rating = (await session.execute(avg_query)).scalar() or 0.0

    if data.target_type == 'vendor':
        target = await session.get(Vendor, data.target_id)
    elif data.target_type == 'rider':
        target = await session.get(Deliverer, data.target_id)
    else:
        target = None
    
    if target:
        target.rating = round(avg_rating, 1)
        await session.commit()

    return review
