from pydantic import BaseModel, computed_field
from uuid import UUID
from typing import Optional


class BaseProduct(BaseModel):
  id: UUID
  vendor_id: UUID
  name: str
  image_url: str
  capacity: float
  weight_kg: float = 20.0
  minimum_order_qty: int = 1
  price: float 
  discount: float 
  stock: int

  @computed_field
  @property
  def stock_quantity(self) -> int:
    """Alias for `stock` — the frontend references this field name."""
    return self.stock
  
  model_config = {"from_attributes": True}

class ProductThin(BaseModel):
  id: UUID
  vendor_id: UUID
  image_url: str
  
  model_config = {"from_attributes": True}

class VendorSnippet(BaseModel):
  """Lightweight vendor data embedded in product detail responses."""
  id: UUID
  vendor_type: str | None = None
  business_name: str
  location_address: str | None = None
  lat: float | None = None
  lng: float | None = None
  delivery_radius: float | None = None
  rating: float | None = None
  profile_pic: str | None = None

  model_config = {"from_attributes": True}


class ProductFull(BaseProduct):
  description: str | None
  unit: str | None 
  is_available: bool
  vendor: Optional[VendorSnippet] = None
  
  model_config = {"from_attributes": True}

class RequestBodyProductId(BaseModel):
  id: UUID
  
  model_config = {"from_attributes": True}