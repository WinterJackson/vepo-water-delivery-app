from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.vendor_model import Vendor
from schemas.vendor_schemas import BaseVendor, VendorWithProductsThin, VendorWithProductsFull
from geoalchemy2.functions import ST_Distance
from sqlalchemy import func , and_, or_
from sqlalchemy.orm import joinedload
from uuid import UUID


async def get_all_vendors(session: AsyncSession, limit: int = 20, offset: int = 0):
  count_query = select(func.count()).select_from(Vendor)
  count_result = await session.execute(count_query)
  total = count_result.scalar() or 0

  query = select(Vendor).order_by(Vendor.created_at.desc()).offset(offset).limit(limit)
  result = await session.execute(query)
  vendors = result.scalars().all()
  return vendors, total

async def get_nearby_vendors(session : AsyncSession, lat : float, lng : float ) -> list[VendorWithProductsThin]:
  user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
  user_point = func.ST_GeogFromText(user_location_wkt)
  query = select(Vendor).where(Vendor.vendor_type == "retail_refill").options(joinedload(Vendor.products)).order_by(ST_Distance(Vendor.location, user_point)).limit(3)
  result = await session.execute(query)
  vendors = result.unique().scalars().all()
  return vendors

async def get_top_rated_vendors(session: AsyncSession, lat : float, lng: float) -> list[BaseVendor]:
  user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
  user_point = func.ST_GeogFromText(user_location_wkt)
  query = select(Vendor).where(and_(Vendor.vendor_type == "retail_refill", Vendor.rating >= 4)).order_by(ST_Distance(Vendor.location, user_point)).limit(10)
  result = await session.execute(query)
  vendors = result.unique().scalars().all()
  return vendors

async def get_vendors_by_type_service(session : AsyncSession, type: str, lng: float, lat: float) -> list[BaseVendor]:
  # check if type is provided [IF NOT PROVIDED RAISE AN ERROR]
  # check if coords are provided [IF NOT PROVIDED FETCH ANYWAY USING A DIFFERENT QUERY]
  if not type:
    raise HTTPException(status_code=400, detail="\'vendor_type\' parameter is required")
  if type != "retail_refill":
    query_without_location=select(Vendor).where(Vendor.vendor_type == type).order_by(Vendor.rating.desc()).limit(10)
    result = await session.execute(query_without_location)
    vendors = result.unique().scalars().all()
    return vendors
  user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
  user_point = func.ST_GeogFromText(user_location_wkt)
  query_with_location = select(Vendor).where(Vendor.vendor_type == type).order_by(ST_Distance(Vendor.location ,user_point)).limit(10)
  result = await session.execute(query_with_location)
  vendors = result.unique().scalars().all()
  return vendors

async def get_vendor_by_id_service(session: AsyncSession, id: UUID) -> VendorWithProductsFull:
  query = select(Vendor).where(Vendor.id == id).options(joinedload(Vendor.products))
  result = await session.execute(query)
  vendor = result.unique().scalar_one_or_none()
  return vendor

async def get_top_brands_service(session : AsyncSession, lat : float, lng : float) -> list[BaseVendor]:
  if not lat and not lng:
    raise HTTPException(status_code=400 , detail="Coordinates are required for this service")
  
  
  # Wholesale B2B brands don't need proximity sorting (truck delivery nationwide)
  query = select(Vendor).where(and_(Vendor.vendor_type == "wholesale_b2b", Vendor.rating >= 4)).order_by(Vendor.rating.desc()).limit(10)
  result = await session.execute(query)
  vendors = result.unique().scalars().all()
  return vendors

async def get_vendor_directory(session: AsyncSession, lat: float, lng: float, limit: int = 50) -> list[VendorWithProductsThin]:
    user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
    user_point = func.ST_GeogFromText(user_location_wkt)
    query = (
        select(Vendor)
        .options(joinedload(Vendor.products))
        .order_by(ST_Distance(Vendor.location, user_point))
        .limit(limit)
    )
    result = await session.execute(query)
    vendors = result.unique().scalars().all()
    return vendors