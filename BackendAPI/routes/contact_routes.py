from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from schemas.contact_schemas import OrderContactsResponse
from services.contact_service import get_order_contacts

router = APIRouter()

@router.get("/contacts/{order_id}", response_model=OrderContactsResponse)
async def fetch_order_contacts(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Fetch contact information for the other parties involved in an active order.
    The caller must be the customer, vendor, or rider on the order.
    """
    clerk_id = user["sub"]
    return await get_order_contacts(session=db, order_id=order_id, requester_clerk_id=clerk_id)
