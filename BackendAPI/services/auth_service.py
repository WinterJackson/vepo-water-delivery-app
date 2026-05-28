from sqlalchemy.ext.asyncio import AsyncSession
from models.user_model import User
from schemas.user_schemas import BaseUser

# CREATE USER 
async def createUser( db: AsyncSession , data: BaseUser ):
  user_instance = User(
    clerk_id = data.clerk_id,
    full_name = data.full_name,
    email = data.email,
    phone_number = data.phone_number,
    profile_pic = data.profile_pic
  )
  db.add(user_instance)
  await db.commit()
  await db.refresh(user_instance)
  return user_instance


# check if user exists