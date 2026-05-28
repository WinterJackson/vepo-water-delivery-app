from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.query_service import search_service, search_vendors_service
from schemas.product_schemas import ProductFull
from schemas.vendor_schemas import VendorOut

router = APIRouter()

@router.get("/search", response_model=list[ProductFull])
async def search(
  query: str | None = Query(None, min_length=2, max_length=100),
  category: str | None = Query(None),
  mode: str | None = Query(None),
  limit: int = Query(20, ge=1, le=100),
  offset: int = Query(0, ge=0),
  user_lat: float | None = Query(None),
  user_lng: float | None = Query(None),
  db: AsyncSession = Depends(get_db),
  user=Depends(get_current_user)
):
  products = await search_service(session=db, query=query, category=category, mode=mode, limit=limit, offset=offset, user_lat=user_lat, user_lng=user_lng)
  return products

@router.get("/search/vendors", response_model=list[VendorOut])
async def search_vendors(
  query: str | None = Query(None, min_length=2, max_length=100),
  limit: int = Query(20, ge=1, le=100),
  offset: int = Query(0, ge=0),
  user_lat: float | None = Query(None),
  user_lng: float | None = Query(None),
  db: AsyncSession = Depends(get_db),
  user=Depends(get_current_user)
):
  vendors = await search_vendors_service(session=db, query=query, limit=limit, offset=offset, user_lat=user_lat, user_lng=user_lng)
  return vendors