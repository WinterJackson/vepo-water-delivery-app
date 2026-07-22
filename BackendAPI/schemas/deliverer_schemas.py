from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Literal, Optional, Any
from pydantic import field_validator
from utils.s3_utils import generate_presigned_url

class CreateDeliverer(BaseModel):
    clerk_id: str
    email: EmailStr
    name: str
    phone_number: str | None = None
    vehicle_type: Literal["motorbike", "tuktuk", "truck"] = "motorbike"
    plate_number: str | None = None
    employment_model: Literal["gig_economy", "in_house"] = "gig_economy"
    employer_vendor_id: UUID | None = None
    ID_number: str | None = None
    
    model_config = {"from_attributes": True}

class DelivererProfileResponse(BaseModel):
    id: UUID
    clerk_id: str | None = None
    name: str
    email: EmailStr
    phone_number: str | None = None
    profile_pic: str | None = None
    driver_license: str | None = None
    vehicle_type: str | None = None
    employment_model: str | None = None
    plate_number: str | None = None
    kyc_status: str | None = None
    current_lat: float | None = None
    current_lng: float | None = None
    operation_lat: float | None = None
    operation_lng: float | None = None
    preferences: dict | None = None
    payment_methods: list | None = None
    zone_changes_this_month: int | None = 0
    is_available: bool | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    is_platinum: bool | None = None
    rating: float | None = None
    acceptance_rate: float | None = None
    employer_vendor_id: UUID | None = None
    wallet_balance: float | None = 0.0
    @field_validator('profile_pic', 'driver_license', mode='after')
    @classmethod
    def secure_urls(cls, v: str | None) -> str | None:
        if v and not v.startswith('http') and not v.startswith('/api/uploads/'):
            return generate_presigned_url(v)
        return v

    model_config = {"from_attributes": True}
