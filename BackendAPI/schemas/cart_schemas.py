from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from schemas.product_schemas import ProductFull
from typing import List, Optional


class CartBase(BaseModel):
  id : UUID
  customer_id: UUID
  items_count: int
  total_amount: float 
  
  model_config = {"from_attributes": True}

class CartItemBase(BaseModel):
  id: UUID 
  cart_id: UUID 
  vendor_id: UUID 
  product_id: UUID 
  quantity: int 
  price: float 
  product: Optional[ProductFull] 
  
  model_config = {"from_attributes": True}

class CartDetailed(CartBase):
  cart_item: List[CartItemBase]
  welcome_discount_amount: Optional[float] = 0.0
  service_fee: Optional[float] = 0.0
  delivery_fee_quick_swap: Optional[float] = 0.0
  delivery_fee_keep_my_bottle: Optional[float] = 0.0
  
  model_config = {"from_attributes": True}