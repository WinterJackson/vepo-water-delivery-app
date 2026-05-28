import logging
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models.vendor_remittance_model import VendorRemittance, VendorRemittanceStatus
from models.vendor_model import Vendor

logger = logging.getLogger(__name__)

async def start_vendor_remittance(session: AsyncSession, deliverer_id: UUID, vendor_id: UUID, full_bottles_out: int) -> VendorRemittance:
    # Check if an open vendor_remittance already exists for this rider-vendor pair
    query = select(VendorRemittance).where(
        and_(
            VendorRemittance.deliverer_id == deliverer_id,
            VendorRemittance.status == VendorRemittanceStatus.OPEN
        )
    )
    result = await session.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="Rider already has an open Gate Pass. Close it before starting a new one.")
        
    # BUG-GP-01 FIX: Verify the rider is actually approved for this vendor
    from models.vendor_rider_model import VendorRiderRegistry
    registry_query = select(VendorRiderRegistry).where(
        and_(
            VendorRiderRegistry.rider_id == deliverer_id,
            VendorRiderRegistry.vendor_id == vendor_id,
            VendorRiderRegistry.status == "approved"
        )
    )
    registry_result = await session.execute(registry_query)
    if not registry_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Rider is not approved for this vendor.")

    vendor_remittance = VendorRemittance(
        deliverer_id=deliverer_id,
        vendor_id=vendor_id,
        full_bottles_out=full_bottles_out,
        status=VendorRemittanceStatus.OPEN
    )
    
    # Deduct from vendor full bottle inventory natively
    vendor = await session.get(Vendor, vendor_id)
    if vendor:
        if vendor.full_bottle_inventory < full_bottles_out:
            raise HTTPException(status_code=400, detail="Vendor does not have enough full bottles in stock.")
        vendor.full_bottle_inventory -= full_bottles_out
    
    session.add(vendor_remittance)
    await session.commit()
    await session.refresh(vendor_remittance)
    return vendor_remittance

async def close_vendor_remittance(session: AsyncSession, vendor_remittance_id: UUID, full_bottles_returned: int, empty_bottles_collected: int, cash_collected: float) -> VendorRemittance:
    vendor_remittance = await session.get(VendorRemittance, vendor_remittance_id)
    if not vendor_remittance:
        raise HTTPException(status_code=404, detail="Gate Pass not found")
        
    if vendor_remittance.status != VendorRemittanceStatus.OPEN:
        raise HTTPException(status_code=400, detail="Gate Pass is already settled or in discrepancy.")
        
    vendor_remittance.full_bottles_returned = full_bottles_returned
    vendor_remittance.empty_bottles_collected = empty_bottles_collected
    vendor_remittance.cash_collected = cash_collected
    
    # Check for discrepancies conceptually (for now, simply close it and vendor can dispute if needed)
    expected_empties = vendor_remittance.full_bottles_out - full_bottles_returned
    
    if empty_bottles_collected < expected_empties:
        vendor_remittance.status = VendorRemittanceStatus.DISCREPANCY
    else:
        vendor_remittance.status = VendorRemittanceStatus.SETTLED

    # Add back to vendor inventory
    vendor = await session.get(Vendor, vendor_remittance.vendor_id)
    if vendor:
        vendor.full_bottle_inventory += full_bottles_returned
        vendor.empty_bottle_inventory += empty_bottles_collected

    await session.commit()
    await session.refresh(vendor_remittance)
    return vendor_remittance

async def get_rider_vendor_remittances(session: AsyncSession, deliverer_id: UUID):
    query = select(VendorRemittance).where(VendorRemittance.deliverer_id == deliverer_id).order_by(VendorRemittance.created_at.desc())
    result = await session.execute(query)
    return result.scalars().all()

async def get_vendor_vendor_remittances(session: AsyncSession, vendor_id: UUID):
    query = select(VendorRemittance).where(VendorRemittance.vendor_id == vendor_id).order_by(VendorRemittance.created_at.desc())
    result = await session.execute(query)
    return result.scalars().all()
