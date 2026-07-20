from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from schemas.user_schemas import CustomerPublicProfile
from schemas.vendor_schemas import BaseVendor
from schemas.product_schemas import ProductFull, OrderProductDetail
from typing import List, Optional
from datetime import datetime


class OrderItemBase(BaseModel):
  id: UUID
  order_id: UUID
  product_id: UUID
  quantity: int
  price: float
  Subtotal: float
  product: Optional[OrderProductDetail] = None
  
  model_config = {"from_attributes": True}


class OrderVendorSnippet(BaseModel):
  """Vendor data embedded in order responses — includes location_address for display (M-06 FIX)."""
  id: UUID
  business_name: str
  profile_pic: str | None = None
  vendor_type: str | None = None
  location_address: str | None = None
  lat: float | None = None
  lng: float | None = None
  rating: float | None = None
  phone_number: str | None = None

  model_config = {"from_attributes": True, "use_enum_values": True}


class OrderDelivererSnippet(BaseModel):
  """Rider data embedded in order responses."""
  id: UUID
  full_name: str | None = None
  phone_number: str | None = None
  vehicle_details: str | None = None

  model_config = {"from_attributes": True}


class BaseOrder(BaseModel):
  id: UUID
  customer_id: UUID
  vendor_id: UUID
  deliverer_id: UUID | None = None
  delivery_address: str | None = None
  checkout_request_ID: str | None = None
  phone: str | None = None
  lat_from: float | None = None
  lng_from: float | None = None
  lat: float | None = None
  lng: float | None = None
  total_amount: float | None = None
  order_status: str | None = None
  payment_status: str | None = None
  payment_method: str | None = None
  delivery_fee: float | None = None
  delivery_time: int | None = None
  delivery_type: str | None = "quick_swap"
  bottle_source: str | None = "platform"
  is_welcome_offer: bool | None = False
  customer_note: str | None = None
  proof_url: str | None = None

  # ── Financial Breakdown ──
  rider_net: float | None = 0.0
  rider_commission: float | None = 0.0
  vendor_commission: float | None = 0.0
  service_fee: float | None = 0.0
  surge_fee: float | None = 0.0
  delivery_markup: float | None = 0.0
  platform_total: float | None = 0.0
  vendor_net: float | None = 0.0
  payload_surcharge: float | None = 0.0
  staircase_surcharge: float | None = 0.0
  distance_km: float | None = 0.0
  vehicle_class: str | None = "motorbike"

  # ── Discount Audit Trail (H-07 FIX) ──
  wallet_discount: float | None = 0.0
  welcome_discount: float | None = 0.0
  product_subtotal: float | None = 0.0

  # ── Relationships (C-02 FIX) ──
  vendor: Optional[OrderVendorSnippet] = None
  deliverer: Optional[OrderDelivererSnippet] = None
  order_item: List[OrderItemBase] = []

  created_at: datetime
  updated_at: datetime | None = None

  model_config = {"from_attributes": True}


class OrderWithDetails(BaseOrder):
    user: Optional[CustomerPublicProfile] = None
    distance_km: Optional[float] = None
    
    model_config = {"from_attributes": True}


class PaginatedOrders(BaseModel):
    pages: List[List[OrderWithDetails]]
    
    model_config = {"from_attributes": True}

