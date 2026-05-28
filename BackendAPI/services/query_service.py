from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from models.product_model import Product
from models.vendor_model import Vendor
from schemas.product_schemas import ProductFull
from schemas.vendor_schemas import VendorOut

from sqlalchemy.orm import joinedload
from geoalchemy2 import Geography

async def search_service(session: AsyncSession, query: str | None, limit: int = 20, offset: int = 0, category: str | None = None, mode: str | None = None, user_lat: float | None = None, user_lng: float | None = None) -> list[ProductFull]:
    stmt = select(Product).options(joinedload(Product.vendor))
    
    order_by_clauses = []

    if user_lat is not None and user_lng is not None:
        stmt = stmt.join(Vendor, Product.vendor_id == Vendor.id)
        user_location = func.ST_SetSRID(func.ST_MakePoint(user_lng, user_lat), 4326).cast(Geography)
        order_by_clauses.append(func.ST_Distance(Vendor.location, user_location).asc())

    if mode == "deals":
        stmt = stmt.where(Product.discount > 0, Product.is_available == True)
        if category and category != "all":
            stmt = stmt.where(Product.category == category)
        order_by_clauses.append((Product.discount / Product.price).desc())
    elif mode == "refill_wholesale":
        if category and category != "all":
            stmt = stmt.where(Product.category == category, Product.is_available == True)
        else:
            stmt = stmt.where(Product.category.in_(["dispenser_refill", "jerrycan", "bulk_wholesale"]), Product.is_available == True)
        order_by_clauses.append(Product.created_at.desc())
    elif query and query.strip():
        # Full-text search with optional category filter
        ts_query = func.websearch_to_tsquery('english', query)
        stmt = stmt.where(Product.search_vector.op('@@')(ts_query))
        if category:
            stmt = stmt.where(Product.category == category)
        order_by_clauses.append(func.ts_rank(Product.search_vector, ts_query).desc())
    elif category:
        # Category-only browsing — no text query required
        stmt = stmt.where(Product.category == category)
        order_by_clauses.append(Product.created_at.desc())
    else:
        # No query and no category — return latest products
        order_by_clauses.append(Product.created_at.desc())
    
    if order_by_clauses:
        stmt = stmt.order_by(*order_by_clauses)
    
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    products = result.unique().scalars().all()
    return products

async def search_vendors_service(session: AsyncSession, query: str | None, limit: int = 20, offset: int = 0, user_lat: float | None = None, user_lng: float | None = None) -> list[VendorOut]:
    stmt = select(Vendor)
    order_by_clauses = []

    if user_lat is not None and user_lng is not None:
        user_location = func.ST_SetSRID(func.ST_MakePoint(user_lng, user_lat), 4326).cast(Geography)
        order_by_clauses.append(func.ST_Distance(Vendor.location, user_location).asc())

    if query and query.strip():
        ts_query = func.websearch_to_tsquery('english', query)
        stmt = stmt.where(Vendor.search_vector.op('@@')(ts_query))
        order_by_clauses.append(func.ts_rank(Vendor.search_vector, ts_query).desc())
    else:
        order_by_clauses.append(Vendor.created_at.desc())

    if order_by_clauses:
        stmt = stmt.order_by(*order_by_clauses)

    stmt = stmt.limit(limit).offset(offset)
    
    result = await session.execute(stmt)
    vendors = result.scalars().all()
    return vendors
