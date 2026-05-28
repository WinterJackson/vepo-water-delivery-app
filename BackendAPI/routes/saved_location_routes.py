from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from schemas.saved_location_schemas import SavedLocationCreate, SavedLocationUpdate, SavedLocationOut
from services.saved_location_service import (
    list_saved_locations,
    create_saved_location,
    update_saved_location,
    delete_saved_location,
    use_saved_location,
)
from uuid import UUID

router = APIRouter()


@router.get("/saved-locations", response_model=list[SavedLocationOut])
async def get_locations(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all saved locations for the authenticated user, ordered by default → recency."""
    clerk_id = user["sub"]
    return await list_saved_locations(session=db, clerk_id=clerk_id)


@router.post("/saved-locations", response_model=SavedLocationOut)
async def add_location(
    body: SavedLocationCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new saved location (max 10 per user)."""
    clerk_id = user["sub"]
    return await create_saved_location(session=db, clerk_id=clerk_id, data=body)


@router.put("/saved-locations/{location_id}", response_model=SavedLocationOut)
async def edit_location(
    location_id: UUID,
    body: SavedLocationUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update an existing saved location."""
    clerk_id = user["sub"]
    return await update_saved_location(session=db, clerk_id=clerk_id, location_id=location_id, data=body)


@router.delete("/saved-locations/{location_id}")
async def remove_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete a saved location."""
    clerk_id = user["sub"]
    return await delete_saved_location(session=db, clerk_id=clerk_id, location_id=location_id)


@router.post("/saved-locations/{location_id}/use", response_model=SavedLocationOut)
async def select_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Select a saved location as the active delivery address.
    Updates use_count, last_used_at, and syncs to User.lat/lng/location_address."""
    clerk_id = user["sub"]
    return await use_saved_location(session=db, clerk_id=clerk_id, location_id=location_id)
