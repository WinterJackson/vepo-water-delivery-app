from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from models.review_model import Review
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from schemas.review_schemas import ReviewCreate

async def create_review(session: AsyncSession, clerk_id: str, data: ReviewCreate):
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
