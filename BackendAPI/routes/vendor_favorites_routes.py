from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from dependencies.auth_dependencies import get_current_customer
from services.vendor_favorites_service import (
    get_vendor_favorites,
    add_vendor_favorite,
    remove_vendor_favorite,
    get_last_order_to_vendor,
)
from pydantic import BaseModel

router = APIRouter()


class VendorFavoriteRequest(BaseModel):
    vendor_id: str


@router.get("/")
async def list_vendor_favorites(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_customer),
):
    """Get all vendor favorites for the current user."""
    clerk_id = user["sub"]
    return await get_vendor_favorites(session=db, clerk_id=clerk_id)


@router.post("/add")
async def add_to_vendor_favorites(
    body: VendorFavoriteRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_customer),
):
    """Add a vendor to the user's favorites."""
    clerk_id = user["sub"]
    return await add_vendor_favorite(session=db, clerk_id=clerk_id, vendor_id=body.vendor_id)


@router.post("/remove")
async def remove_from_vendor_favorites(
    body: VendorFavoriteRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_customer),
):
    """Remove a vendor from the user's favorites."""
    clerk_id = user["sub"]
    return await remove_vendor_favorite(session=db, clerk_id=clerk_id, vendor_id=body.vendor_id)


@router.get("/{vendor_id}/last-order")
async def vendor_last_order(
    vendor_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_customer),
):
    """Get the most recent order to a specific vendor for quick reorder."""
    clerk_id = user["sub"]
    result = await get_last_order_to_vendor(session=db, clerk_id=clerk_id, vendor_id=vendor_id)
    if result is None:
        return {"order": None, "message": "No previous orders to this vendor"}
    return {"order": result}
