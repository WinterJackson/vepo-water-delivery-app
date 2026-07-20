from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.favorites_model import Favorite
from models.user_model import User
from sqlalchemy.orm import selectinload


async def get_user_id_from_clerk(session: AsyncSession, clerk_id: str):
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.id


async def get_favorites(session: AsyncSession, clerk_id: str):
    user_id = await get_user_id_from_clerk(session, clerk_id)
    query = select(Favorite).where(Favorite.user_id == user_id).options(selectinload(Favorite.product))
    result = await session.execute(query)
    favorites = result.scalars().all()
    return [
        {
            "id": str(fav.id),
            "product_id": str(fav.product_id),
            "product": {
                "id": str(fav.product.id),
                "name": fav.product.name,
                "price": fav.product.price,
                "discount": fav.product.discount,
                "image_url": fav.product.image_url,
            } if fav.product else None
        }
        for fav in favorites
    ]


async def add_favorite(session: AsyncSession, clerk_id: str, product_id: str):
    user_id = await get_user_id_from_clerk(session, clerk_id)
    
    from models.product_model import Product
    product_exists = await session.execute(select(Product.id).where(Product.id == product_id))
    if not product_exists.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already favourited
    existing = await session.execute(
        select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == product_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already in favourites")
    
    fav = Favorite(user_id=user_id, product_id=product_id)
    session.add(fav)
    await session.commit()
    return {"message": "Added to favourites", "id": str(fav.id)}


async def remove_favorite(session: AsyncSession, clerk_id: str, product_id: str):
    user_id = await get_user_id_from_clerk(session, clerk_id)
    result = await session.execute(
        select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == product_id)
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="Favourite not found")
    await session.delete(fav)
    await session.commit()
    return {"message": "Removed from favourites"}
