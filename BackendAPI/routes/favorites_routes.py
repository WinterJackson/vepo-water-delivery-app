from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.favorites_service import get_favorites, add_favorite, remove_favorite
from pydantic import BaseModel

router = APIRouter()


class FavoriteRequest(BaseModel):
    product_id: str


@router.get("/")
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    clerk_id = user["sub"]
    return await get_favorites(session=db, clerk_id=clerk_id)


@router.post("/add")
async def add_to_favorites(
    body: FavoriteRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    clerk_id = user["sub"]
    return await add_favorite(session=db, clerk_id=clerk_id, product_id=body.product_id)


@router.post("/remove")
async def remove_from_favorites(
    body: FavoriteRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    clerk_id = user["sub"]
    return await remove_favorite(session=db, clerk_id=clerk_id, product_id=body.product_id)
