import h3
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
  
  center_h3 = h3.latlng_to_cell(lat, lng, 8)
  neighbor_cells = [str(cell) for cell in h3.grid_disk(center_h3, 5)] # Retail (k=5)
  
  query = select(Vendor).where(and_(Vendor.vendor_type == "retail_refill", Vendor.h3_index_res8.in_(neighbor_cells))).options(joinedload(Vendor.products)).order_by(ST_Distance(Vendor.location, user_point)).limit(3)
  result = await session.execute(query)
  vendors = result.unique().scalars().all()
  return vendors

async def get_top_rated_vendors(session: AsyncSession, lat : float, lng: float) -> list[BaseVendor]:
  user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
  user_point = func.ST_GeogFromText(user_location_wkt)
  
  center_h3 = h3.latlng_to_cell(lat, lng, 8)
  neighbor_cells = [str(cell) for cell in h3.grid_disk(center_h3, 5)] # Retail (k=5)
  
  query = select(Vendor).where(and_(Vendor.vendor_type == "retail_refill", Vendor.rating >= 4, Vendor.h3_index_res8.in_(neighbor_cells))).order_by(ST_Distance(Vendor.location, user_point)).limit(10)
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
  
  center_h3 = h3.latlng_to_cell(lat, lng, 8)
  k_rings = 32 if type == "wholesale_b2b" else 5
  neighbor_cells = [str(cell) for cell in h3.grid_disk(center_h3, k_rings)]
  
  query_with_location = select(Vendor).where(and_(Vendor.vendor_type == type, Vendor.h3_index_res8.in_(neighbor_cells))).order_by(ST_Distance(Vendor.location ,user_point)).limit(10)
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

from typing import Optional

async def get_vendor_directory(
    session: AsyncSession, 
    lat: float, 
    lng: float, 
    limit: int = 50,
    search_query: Optional[str] = None,
    vendor_type: Optional[str] = "all"
) -> list[VendorWithProductsThin]:
    user_location_wkt = f"SRID=4326;POINT({lng} {lat})"
    user_point = func.ST_GeogFromText(user_location_wkt)
    
    center_h3 = h3.latlng_to_cell(lat, lng, 8)
    k_rings = 32 if vendor_type == "wholesale_b2b" else (5 if vendor_type == "retail_refill" else 32)
    neighbor_cells = [str(cell) for cell in h3.grid_disk(center_h3, k_rings)]
    
    query = select(Vendor).options(joinedload(Vendor.products)).where(Vendor.h3_index_res8.in_(neighbor_cells))
    
    if vendor_type and vendor_type != "all":
        query = query.where(Vendor.vendor_type == vendor_type)
        
    if search_query and search_query.strip():
        # Postgres TSVECTOR Full-Text Search on Vendor.search_vector
        search_term = search_query.strip()
        tsquery = func.websearch_to_tsquery('english', search_term)
        query = query.where(Vendor.search_vector.op("@@")(tsquery))
        
    query = query.order_by(ST_Distance(Vendor.location, user_point)).limit(limit)
    
    result = await session.execute(query)
    vendors = result.unique().scalars().all()
    return vendors