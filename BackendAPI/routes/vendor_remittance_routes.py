from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.vendor_remittance_service import (
    start_vendor_remittance,
    close_vendor_remittance,
    get_rider_vendor_remittances,
    get_vendor_vendor_remittances
)
from pydantic import BaseModel
from uuid import UUID

router = APIRouter()

class StartVendorRemittanceRequest(BaseModel):
    deliverer_id: UUID
    vendor_id: UUID
    full_bottles_out: int

class CloseVendorRemittanceRequest(BaseModel):
    full_bottles_returned: int
    empty_bottles_collected: int
    cash_collected: float

@router.post("/start")
async def start_new_vendor_remittance(
    body: StartVendorRemittanceRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        vendor_remittance = await start_vendor_remittance(
            session=db,
            deliverer_id=body.deliverer_id,
            vendor_id=body.vendor_id,
            full_bottles_out=body.full_bottles_out
        )
        return vendor_remittance
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{vendor_remittance_id}/close")
async def finish_vendor_remittance(
    vendor_remittance_id: UUID,
    body: CloseVendorRemittanceRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        vendor_remittance = await close_vendor_remittance(
            session=db,
            vendor_remittance_id=vendor_remittance_id,
            full_bottles_returned=body.full_bottles_returned,
            empty_bottles_collected=body.empty_bottles_collected,
            cash_collected=body.cash_collected
        )
        return vendor_remittance
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/rider/{deliverer_id}")
async def fetch_rider_vendor_remittances(
    deliverer_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_rider_vendor_remittances(session=db, deliverer_id=deliverer_id)

@router.get("/vendor/{vendor_id}")
async def fetch_vendor_vendor_remittances(
    vendor_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_vendor_vendor_remittances(session=db, vendor_id=vendor_id)
