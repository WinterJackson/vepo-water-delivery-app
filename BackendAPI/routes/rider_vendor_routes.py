from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.deliverer_service import get_deliverer_by_clerk_id
from models.vendor_rider_model import VendorRiderRegistry
from models.vendor_model import Vendor
from sqlalchemy import select, and_, func
from geoalchemy2.functions import ST_Distance
from pydantic import BaseModel
import uuid
import math
from geoalchemy2.shape import to_shape
from services.dispatch_policy import DispatchPolicy

router = APIRouter()

class ApplyRequest(BaseModel):
    vendor_id: str

@router.get("/discover-vendors")
async def discover_nearby_vendors(lat: float, lng: float, session: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    clerk_id = user["sub"]
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Use the lat/lng passed from the map coordinates (allows preview before saving)
    location_wkt = f"SRID=4326;POINT({lng} {lat})"
    point = func.ST_GeogFromText(location_wkt)

    # Get rider's current registry entries to exclude them from the list
    reg_query = select(VendorRiderRegistry.vendor_id).where(VendorRiderRegistry.rider_id == deliverer.id)
    reg_res = await session.execute(reg_query)
    registered_vendor_ids = [r for r in reg_res.scalars().all()]

    if deliverer.employer_vendor_id:
        registered_vendor_ids.append(deliverer.employer_vendor_id)

    # Find closest 20 vendors
    query = select(Vendor, ST_Distance(Vendor.location, point).label("distance")).where(
        Vendor.id.notin_(registered_vendor_ids) if registered_vendor_ids else True
    ).order_by(
        ST_Distance(Vendor.location, point)
    ).limit(20)

    result = await session.execute(query)
    rows = result.all()

    vendors = []
    for vendor, distance in rows:
        v_point = to_shape(vendor.location) if vendor.location else None
        vendors.append({
            "id": str(vendor.id),
            "business_name": vendor.business_name,
            "address": vendor.location_address,
            "profile_pic": vendor.profile_pic,
            "distance_km": round((distance or 0) / 1000.0, 2),
            "status": "unregistered",
            "lat": v_point.y if v_point else None,
            "lng": v_point.x if v_point else None
        })

    return vendors

@router.get("/registered-vendors")
async def get_registered_vendors(session: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    clerk_id = user["sub"]
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Join VendorRiderRegistry with Vendor
    query = select(VendorRiderRegistry, Vendor).join(Vendor, Vendor.id == VendorRiderRegistry.vendor_id).where(
        VendorRiderRegistry.rider_id == deliverer.id
    ).order_by(VendorRiderRegistry.requested_at.desc())
    
    result = await session.execute(query)
    
    registered = []
    registered_vendor_ids = set()
    
    for reg, vendor in result.all():
        registered_vendor_ids.add(str(vendor.id))
        registered.append({
            "registry_id": str(reg.id),
            "vendor_id": str(vendor.id),
            "business_name": vendor.business_name,
            "address": vendor.location_address,
            "profile_pic": vendor.profile_pic,
            "status": reg.status,
            "created_at": reg.requested_at.isoformat() if reg.requested_at else None
        })
        
    # Inject employer vendor if not in registry
    if deliverer.employer_vendor_id and str(deliverer.employer_vendor_id) not in registered_vendor_ids:
        employer_vendor = await session.get(Vendor, deliverer.employer_vendor_id)
        if employer_vendor:
            registered.append({
                "registry_id": "employer",
                "vendor_id": str(employer_vendor.id),
                "business_name": employer_vendor.business_name,
                "address": employer_vendor.location_address,
                "profile_pic": employer_vendor.profile_pic,
                "status": "approved",
                "created_at": None
            })
            
    return registered

@router.delete("/vendor-application/{vendor_id}")
async def withdraw_vendor_application(vendor_id: str, session: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    clerk_id = user["sub"]
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    vendor_uuid = uuid.UUID(vendor_id)
    
    query = select(VendorRiderRegistry).where(
        and_(
            VendorRiderRegistry.rider_id == deliverer.id,
            VendorRiderRegistry.vendor_id == vendor_uuid
        )
    )
    result = await session.execute(query)
    registry = result.scalar_one_or_none()
    
    if not registry:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if registry.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot withdraw from an approved vendor. Please contact support.")
        
    await session.delete(registry)
    await session.commit()
    
    return {"message": "Application withdrawn successfully"}

@router.post("/apply-vendor")
async def apply_to_vendor(request: ApplyRequest, session: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    clerk_id = user["sub"]
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    vendor_uuid = uuid.UUID(request.vendor_id)
    vendor = await session.get(Vendor, vendor_uuid)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    # Check registration distance limits (2.0km)
    if deliverer.operation_lat and deliverer.operation_lng and vendor.location:
        vendor_point = to_shape(vendor.location)
        
        # Calculate Haversine distance in kilometers
        lon1, lat1 = map(math.radians, [deliverer.operation_lng, deliverer.operation_lat])
        lon2, lat2 = map(math.radians, [vendor_point.x, vendor_point.y])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        distance_km = 2 * math.asin(math.sqrt(a)) * 6371
        
        if distance_km > DispatchPolicy.RIDER_REGISTRATION_MAX_RADIUS_KM:
            raise HTTPException(status_code=400, detail=f"Vendor is too far. Registration is limited to {DispatchPolicy.RIDER_REGISTRATION_MAX_RADIUS_KM}km from your Operation Base.")
    else:
        raise HTTPException(status_code=400, detail="Operation base not set. Please set your Operation Base in Settings first.")

    # BUG-REG-01 FIX: Only count pending and approved registrations toward the 10-vendor cap
    limit_query = select(func.count(VendorRiderRegistry.id)).where(
        and_(
            VendorRiderRegistry.rider_id == deliverer.id,
            VendorRiderRegistry.status.in_(["pending", "approved"])
        )
    )
    total_registrations = (await session.execute(limit_query)).scalar() or 0
    if total_registrations >= 10:
        raise HTTPException(status_code=400, detail="You can only register to a maximum of 10 vendors at a time.")

    # Check existing
    existing = await session.execute(
        select(VendorRiderRegistry).where(
            and_(
                VendorRiderRegistry.rider_id == deliverer.id,
                VendorRiderRegistry.vendor_id == vendor_uuid
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already registered or pending for this vendor.")

    # Create new application
    new_reg = VendorRiderRegistry(
        vendor_id=uuid.UUID(request.vendor_id),
        rider_id=deliverer.id,
        status="pending"
    )
    session.add(new_reg)
    await session.commit()
    
    return {"message": "Application submitted successfully", "status": "pending"}

