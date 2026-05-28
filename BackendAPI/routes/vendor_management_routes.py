from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.vendor_management_service import (
    register_vendor,
    get_vendor_by_clerk_id,
    get_all_vendors_by_clerk_id,
    update_vendor_profile,
    create_product,
    update_product,
    delete_product,
    get_vendor_orders,
    get_vendor_products,
    update_order_status,
    get_vendor_dashboard,
    cancel_order,
    assign_order_rider
)
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List, Literal
from utils.serializers import safe_serialize
router = APIRouter()


# --- Pydantic Schemas ---
class VendorRegisterRequest(BaseModel):
    owners_name: str
    business_name: str
    email: str
    phone_number: Optional[str] = None
    profile_pic: Optional[str] = None
    vendor_type: Literal["retail_refill", "wholesale_b2b"] = "retail_refill"


class VendorProfileUpdateRequest(BaseModel):
    business_name: Optional[str] = None
    owners_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_pic: Optional[str] = None
    business_license: Optional[str] = None
    location_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    delivery_radius: Optional[float] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    preferred_payment_method: Optional[List[str]] = None
    vendor_type: Optional[Literal["retail_refill", "wholesale_b2b"]] = None
    is_online: Optional[bool] = None


class ProductCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: str
    price: float
    discount: Optional[float] = 0
    capacity: float
    unit: str
    stock: int
    is_available: Optional[bool] = True


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    discount: Optional[float] = None
    capacity: Optional[float] = None
    unit: Optional[str] = None
    stock: Optional[int] = None
    is_available: Optional[bool] = None


class OrderStatusRequest(BaseModel):
    status: str

class AssignRiderRequest(BaseModel):
    deliverer_id: str

# --- Routes ---

@router.post("/register")
async def vendor_register(
    body: VendorRegisterRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    vendor = await register_vendor(session=db, clerk_id=clerk_id, data=body.model_dump())
    return {"message": "Vendor registered", "vendor_id": str(vendor.id)}

@router.get("/stores")
async def vendor_stores(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    stores = await get_all_vendors_by_clerk_id(session=db, clerk_id=clerk_id)
    return stores

@router.put("/staff")
async def vendor_assign_staff(
    staff_clerk_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    # Only the owner can assign staff to their FIRST store for now
    vendor = await get_vendor_by_clerk_id(session=db, clerk_id=clerk_id)
    if not vendor or vendor.clerk_id != clerk_id:
        raise HTTPException(status_code=403, detail="Only the store owner can assign staff.")
    
    vendor.staff_clerk_id = staff_clerk_id
    await db.commit()
    return {"message": "Staff assigned successfully."}



@router.get("/profile")
async def vendor_profile(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    vendor = await get_vendor_by_clerk_id(session=db, clerk_id=clerk_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found. Please register first.")
    
    vendor_data = safe_serialize(vendor)
    vendor_data["role"] = "owner" if vendor.clerk_id == clerk_id else "staff"
    return vendor_data


@router.put("/profile")
async def vendor_update_profile(
    body: VendorProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    vendor = await get_vendor_by_clerk_id(session=db, clerk_id=clerk_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    if vendor.clerk_id != clerk_id:
        restricted_fields = ["preferred_payment_method", "business_name", "owners_name", "business_license", "location_address", "deposit_fee", "shift_start", "shift_end", "lat", "lng", "delivery_radius"]
        for field in restricted_fields:
            if getattr(body, field, None) is not None:
                raise HTTPException(status_code=403, detail="Staff members cannot update restricted store settings.")
                
    updated_vendor = await update_vendor_profile(session=db, clerk_id=clerk_id, data=body.model_dump(exclude_none=True))
    return {"message": "Profile updated", "vendor_id": str(vendor.id)}


@router.post("/products")
async def vendor_create_product(
    body: ProductCreateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    product = await create_product(session=db, clerk_id=clerk_id, data=body.model_dump())
    return {"message": "Product created", "product_id": str(product.id)}


@router.put("/products/{product_id}")
async def vendor_update_product(
    product_id: UUID,
    body: ProductUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    product = await update_product(session=db, clerk_id=clerk_id, product_id=product_id, data=body.model_dump(exclude_none=True))
    return {"message": "Product updated", "product_id": str(product.id)}


@router.delete("/products/{product_id}")
async def vendor_delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    result = await delete_product(session=db, clerk_id=clerk_id, product_id=product_id)
    return result


@router.get("/products")
async def vendor_get_products(
    search_query: Optional[str] = Query(None, description="Search query for product name"),
    stock_filter: str = Query("All", description="Filter by stock: All, Low Stock, Out of Stock"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    products = await get_vendor_products(
        session=db, 
        clerk_id=clerk_id, 
        search_query=search_query, 
        stock_filter=stock_filter, 
        limit=limit, 
        offset=offset
    )
    return {"pages": [products]}


@router.get("/orders")
async def vendor_get_orders(
    search_query: Optional[str] = Query(None, description="Search query for order ID"),
    status_filter: str = Query("All", description="Filter by status: All, pending, accepted, preparing, ready, cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    orders = await get_vendor_orders(
        session=db, 
        clerk_id=clerk_id, 
        search_query=search_query, 
        status_filter=status_filter, 
        skip=skip, 
        limit=limit
    )
    return {"pages": [orders]}


@router.put("/orders/{order_id}/status")
async def vendor_update_order_status(
    order_id: UUID,
    body: OrderStatusRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    result = await update_order_status(session=db, clerk_id=clerk_id, order_id=order_id, new_status=body.status)
    return result


@router.get("/dashboard")
async def vendor_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    clerk_id = user["sub"]
    return await get_vendor_dashboard(session=db, clerk_id=clerk_id)


@router.put("/orders/{order_id}/cancel")
async def vendor_cancel_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Cancel an order before preparation"""
    clerk_id = user["sub"]
    result = await cancel_order(session=db, clerk_id=clerk_id, order_id=order_id)
    return result

@router.put("/orders/{order_id}/assign-rider")
async def vendor_assign_rider(
    order_id: UUID,
    body: AssignRiderRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Assign an order to a specific rider"""
    clerk_id = user["sub"]
    result = await assign_order_rider(session=db, clerk_id=clerk_id, order_id=order_id, rider_id=body.deliverer_id)
    return result
