from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.vendor_model import Vendor
from schemas.vendor_schemas import CreateVendor

async def get_existing_vendor(clerk_id: str, db: AsyncSession):
    query = select(Vendor).where(Vendor.clerk_id == clerk_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_vendor(db: AsyncSession, data: CreateVendor):
    new_vendor = Vendor(
        clerk_id=data.clerk_id,
        email=data.email,
        owners_name=data.owners_name,
        business_name=data.business_name,
        phone_number=data.phone_number,
        vendor_type=data.vendor_type,
        business_license=data.business_license,
        profile_pic=data.profile_pic,
        location_address=data.location_address,
        lat=data.lat,
        lng=data.lng,
        verification_status="pending"
    )
    if data.shift_start is not None:
        new_vendor.shift_start = data.shift_start
    if data.shift_end is not None:
        new_vendor.shift_end = data.shift_end
    db.add(new_vendor)
    await db.commit()
    await db.refresh(new_vendor)
    return new_vendor
