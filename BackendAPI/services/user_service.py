from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.user_model import User
from schemas.vendor_schemas import RequestBodyCoordinates
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from schemas.user_schemas import BasicUser
import h3



async def update_user_location(session : AsyncSession, data: RequestBodyCoordinates, clerk_id : str ):
  # check if clerk id is provided 
  # query the user 
  # check if the user exists
  # then update the user 
  if not clerk_id: 
    raise HTTPException(status_code=400, detail="Clerk_Id Is required for this function")
  
  query = select(User).where(User.clerk_id == clerk_id)
  result = await session.execute(query) 
  user = result.scalar_one_or_none()
  
  if not user: 
    raise HTTPException(status_code=400, detail="User does not exist")
  
  user.lat = data.lat
  user.lng = data.lng
  user.location = from_shape(Point(data.lng, data.lat), srid=4326)
  user.h3_index_res8 = str(h3.latlng_to_cell(data.lat, data.lng, 8))
  if data.location_address is not None:
      user.location_address = data.location_address
  if data.floor_level is not None:
      user.floor_level = data.floor_level
  if data.has_elevator is not None:
      user.has_elevator = data.has_elevator
  await session.commit()


async def get_user_coordinates(session: AsyncSession, clerk_id : str) -> RequestBodyCoordinates:
  if not clerk_id: 
    raise HTTPException(status_code=400, detail="Clerk id is required")
  
  query = select(User).where(User.clerk_id == clerk_id)
  result = await session.execute(query)
  user_coords = result.scalar_one_or_none()
  
  return user_coords

async def get_user(session: AsyncSession, clerk_id : str) -> BasicUser:
  if not clerk_id: 
    raise HTTPException(status_code=400, detail="Clerk id is required")
  
  query = select(User).where(User.clerk_id == clerk_id)
  result = await session.execute(query)
  user = result.scalar_one_or_none()
  
  if not user:
    raise HTTPException(status_code=404, detail="User account not found or missing from database.")
  
  return user

async def update_user_profile_pic(session: AsyncSession, profile_pic: str, clerk_id: str):
  query = select(User).where(User.clerk_id == clerk_id)
  result = await session.execute(query)
  user = result.unique().scalar_one_or_none()
  if not user:
    raise HTTPException(status_code=404, detail="User Not Found")
  user.profile_pic = profile_pic
  await session.commit()
  
