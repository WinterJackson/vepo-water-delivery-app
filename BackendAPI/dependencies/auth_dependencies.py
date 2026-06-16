from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from utils.verify_user_token import get_current_user
from dependencies.dependencies import get_db
from models.user_model import User
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from sqlalchemy import select, or_

async def get_current_customer(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    clerk_id = user["sub"]
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=403, detail="Access denied. Must be a registered customer.")
    return user

async def get_current_vendor(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    clerk_id = user["sub"]
    result = await db.execute(select(Vendor).where(or_(Vendor.clerk_id == clerk_id, Vendor.staff_clerk_id == clerk_id)))
    db_vendor = result.scalar_one_or_none()
    if not db_vendor:
        raise HTTPException(status_code=403, detail="Access denied. Must be a registered vendor.")
    return user

async def get_current_rider(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    clerk_id = user["sub"]
    result = await db.execute(select(Deliverer).where(Deliverer.clerk_id == clerk_id))
    db_rider = result.scalar_one_or_none()
    if not db_rider:
        raise HTTPException(status_code=403, detail="Access denied. Must be a registered rider.")
    return user
