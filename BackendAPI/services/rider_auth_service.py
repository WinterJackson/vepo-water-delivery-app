from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.deliverer_model import Deliverer
from schemas.deliverer_schemas import CreateDeliverer

async def get_existing_rider(clerk_id: str, db: AsyncSession):
    query = select(Deliverer).where(Deliverer.clerk_id == clerk_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_rider(db: AsyncSession, data: CreateDeliverer):
    new_rider = Deliverer(
        clerk_id=data.clerk_id,
        email=data.email,
        name=data.name,
        phone_number=data.phone_number,
        vehicle_type=data.vehicle_type,
        plate_number=data.plate_number,
        ID_number=data.ID_number,
        is_active=True,
        is_verified=True
    )
    db.add(new_rider)
    await db.commit()
    await db.refresh(new_rider)
    return new_rider
