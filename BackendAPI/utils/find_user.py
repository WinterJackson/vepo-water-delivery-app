from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select 
from models.user_model import User
from fastapi import HTTPException
from schemas.user_schemas import BasicUser


# Returns the User ORM object if found, or None if not.
async def get_existing_user(clerk_id: str, db: AsyncSession):
  result = await db.execute(select(User).where(User.clerk_id == clerk_id))
  return result.scalar_one_or_none()

async def get_user(clerk_id: str, db: AsyncSession) -> BasicUser:
  result = await db.execute(select(User).where(User.clerk_id == clerk_id))
  user = result.scalar_one_or_none()
  if not user:
    raise HTTPException(status_code=404, detail="User Not Found")
  return BasicUser.model_validate(user) 


async def get_existing_user_by_email(email: str, db: AsyncSession) -> bool:
  result = await db.execute(select(User).where(User.email == email))
  user = result.scalar_one_or_none()
  if user:
    return True
  return False 
  