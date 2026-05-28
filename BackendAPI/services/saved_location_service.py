from fastapi import HTTPException
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.saved_location_model import SavedLocation
from models.user_model import User
from schemas.saved_location_schemas import SavedLocationCreate, SavedLocationUpdate
from uuid import UUID
from datetime import datetime, timezone

MAX_SAVED_LOCATIONS = 10  # Cap per user to prevent abuse


async def get_user_uuid(session: AsyncSession, clerk_id: str) -> UUID:
    """Resolve clerk_id → User.id (UUID). Raises 404 if not found."""
    result = await session.execute(select(User.id).where(User.clerk_id == clerk_id))
    user_id = result.scalar_one_or_none()
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user_id


async def list_saved_locations(session: AsyncSession, clerk_id: str):
    """List all saved locations for a user, ordered by recency then use_count."""
    user_id = await get_user_uuid(session, clerk_id)
    query = (
        select(SavedLocation)
        .where(SavedLocation.user_id == user_id)
        .order_by(SavedLocation.is_default.desc(), SavedLocation.last_used_at.desc())
    )
    result = await session.execute(query)
    return result.scalars().all()


async def create_saved_location(session: AsyncSession, clerk_id: str, data: SavedLocationCreate):
    """Create a new saved location. Enforces MAX_SAVED_LOCATIONS limit.
    If is_default=True, unset any existing default first."""
    user_id = await get_user_uuid(session, clerk_id)

    # Count existing
    count_result = await session.execute(
        select(func.count()).where(SavedLocation.user_id == user_id)
    )
    count = count_result.scalar() or 0
    if count >= MAX_SAVED_LOCATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_SAVED_LOCATIONS} saved locations reached. Please delete one first."
        )

    # If this is being set as default, unset any existing default
    if data.is_default:
        await session.execute(
            update(SavedLocation)
            .where(SavedLocation.user_id == user_id, SavedLocation.is_default == True)
            .values(is_default=False)
        )

    location = SavedLocation(
        user_id=user_id,
        label=data.label,
        address=data.address,
        lat=data.lat,
        lng=data.lng,
        is_default=data.is_default,
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


async def update_saved_location(session: AsyncSession, clerk_id: str, location_id: UUID, data: SavedLocationUpdate):
    """Update an existing saved location. Ensures ownership."""
    user_id = await get_user_uuid(session, clerk_id)
    result = await session.execute(
        select(SavedLocation).where(SavedLocation.id == location_id, SavedLocation.user_id == user_id)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Saved location not found")

    if data.label is not None:
        location.label = data.label
    if data.address is not None:
        location.address = data.address
    if data.lat is not None:
        location.lat = data.lat
    if data.lng is not None:
        location.lng = data.lng
    if data.is_default is not None and data.is_default:
        # Unset existing default
        await session.execute(
            update(SavedLocation)
            .where(SavedLocation.user_id == user_id, SavedLocation.is_default == True, SavedLocation.id != location_id)
            .values(is_default=False)
        )
        location.is_default = True
    elif data.is_default is not None:
        location.is_default = data.is_default

    await session.commit()
    await session.refresh(location)
    return location


async def delete_saved_location(session: AsyncSession, clerk_id: str, location_id: UUID):
    """Delete a saved location. Ensures ownership."""
    user_id = await get_user_uuid(session, clerk_id)
    result = await session.execute(
        select(SavedLocation).where(SavedLocation.id == location_id, SavedLocation.user_id == user_id)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Saved location not found")

    await session.delete(location)
    await session.commit()
    return {"message": "Location deleted successfully"}


async def use_saved_location(session: AsyncSession, clerk_id: str, location_id: UUID):
    """Mark a saved location as 'used' — increments use_count, updates last_used_at,
    and syncs the user's active delivery address (User.lat/lng/location_address)."""
    user_id = await get_user_uuid(session, clerk_id)

    # Fetch saved location
    result = await session.execute(
        select(SavedLocation).where(SavedLocation.id == location_id, SavedLocation.user_id == user_id)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Saved location not found")

    # Update usage stats
    location.use_count += 1
    location.last_used_at = datetime.now(timezone.utc)

    # Sync to user's active delivery address
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point
        user.lat = location.lat
        user.lng = location.lng
        user.location_address = location.address
        user.location = from_shape(Point(location.lng, location.lat), srid=4326)

    await session.commit()
    await session.refresh(location)
    return location
