from pydantic  import BaseModel, EmailStr
from uuid import UUID
from datetime import time
from typing import List, Literal, Any
from schemas.product_schemas import ProductThin, BaseProduct
from models.vendor_model import VendorBusinessType
from pydantic import field_validator
from utils.s3_utils import generate_presigned_url

class CreateVendor(BaseModel):
    clerk_id: str
    email: EmailStr
    owners_name: str
    business_name: str
    phone_number: str | None = None
    vendor_type: VendorBusinessType = VendorBusinessType.retail_refill
    business_license: str | None = None
    profile_pic: str | None = None
    location_address: str | None = None
    lat: float | None = None
    lng: float | None = None
    shift_start: time | None = None
    shift_end: time | None = None


class BaseVendor(BaseModel):
  id: UUID
  business_name : str
  profile_pic : str | None = None
  vendor_type : VendorBusinessType | None = None
  lat: float | None = None
  lng: float | None = None
  rating : float | None = None
  
  @field_validator('profile_pic', mode='after')
  @classmethod
  def secure_urls(cls, v: str | None) -> str | None:
      if v and not v.startswith('http') and not v.startswith('/api/uploads/'):
          return generate_presigned_url(v)
      return v
  
  model_config = {"from_attributes": True, "use_enum_values": True}


class VendorOut(BaseModel):
  id : UUID
  owners_name: str
  business_name: str
  email: EmailStr
  phone_number: str | None
  profile_pic: str | None
  location_address: str | None
  lat: float | None
  lng: float | None
  delivery_radius: float | None
  shift_start: time
  shift_end: time
  verification_status: str
  rating: float | None
  preferred_payment_method: List[str] | None = None
  
  @field_validator('profile_pic', mode='after')
  @classmethod
  def secure_urls(cls, v: str | None) -> str | None:
      if v and not v.startswith('http') and not v.startswith('/api/uploads/'):
          return generate_presigned_url(v)
      return v
  
  model_config = {"from_attributes": True, "use_enum_values": True}

class VendorWithProductsThin(BaseVendor):
  products : List[ProductThin]
  
  model_config = {"from_attributes": True}

class VendorWithProductsFull(VendorOut):
  shift_start: time
  shift_end: time
  profile_pic: str | None
  products : List[BaseProduct]
  
  model_config = {"from_attributes": True}

class RequestBodyCoordinates(BaseModel):
  lat: float
  lng: float
  location_address: str | None = None
  floor_level: int | None = None
  has_elevator: bool | None = None

  model_config = {"from_attributes": True}


class RequestBodyVendorId(BaseModel):
  id: UUID
  
  model_config = {"from_attributes": True}


class VendorType(BaseModel):
  vendor_type: VendorBusinessType
  # lat: float | None
  # lng: float | None
  
  model_config = {"from_attributes": True, "use_enum_values": True}