import asyncio
import logging
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta, timezone
from db.session import AsyncSessionLocal
from models.deliverer_model import Deliverer
from models.order_model import Order

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def evaluate_platinum_riders():
    """
    Cron job to evaluate if riders qualify for Platinum Status (7% commission).
    Requirements:
    - Delivered at least 20 orders in the past 7 days.
    """
    logger.info("Starting Platinum Rider evaluation...")
    
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    async with AsyncSessionLocal() as session:
        # Get all gig economy riders
        riders_result = await session.execute(
            select(Deliverer).where(Deliverer.employment_model == "gig_economy")
        )
        riders = riders_result.scalars().all()
        
        platinum_count = 0
        demoted_count = 0
        
        for rider in riders:
            # Count delivered orders in the last 7 days
            order_count_result = await session.execute(
                select(func.count(Order.id)).where(
                    and_(
                        Order.deliverer_id == rider.id,
                        Order.order_status == "delivered",
                        Order.updated_at >= seven_days_ago
                    )
                )
            )
            order_count = order_count_result.scalar() or 0
            
            if order_count >= 20:
                if not rider.is_platinum:
                    rider.is_platinum = True
                    platinum_count += 1
            else:
                if rider.is_platinum:
                    rider.is_platinum = False
                    demoted_count += 1
                    
        await session.commit()
        
    logger.info(f"Evaluation complete. Promoted {platinum_count} riders to Platinum. Demoted {demoted_count} riders.")

if __name__ == "__main__":
    asyncio.run(evaluate_platinum_riders())
