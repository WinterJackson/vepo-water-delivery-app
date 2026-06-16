from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import time
from typing import List

class BaseUser(BaseModel):
    clerk_id: str | None = None
    full_name : str | None = None
    email : str 
    phone_number : str | None = None
    profile_pic : str | None = None
    
    model_config = {"from_attributes": True}

class BasicUser(BaseUser):
    lat: float | None
    lng: float | None
    location_address: str | None
    id: UUID
    bottle_purchased_at: str | None = None
    bottle_refill_count: int | None = 0
    wallet_balance: float | None = 0.0
    floor_level: int | None = 0
    has_elevator: bool | None = False
    preferences: dict | None = None
    payment_methods: list | None = None
    
    model_config = {"from_attributes": True}

class CustomerPublicProfile(BaseModel):
    id: UUID
    full_name : str | None = None
    phone_number : str | None = None
    location_address: str | None = None
    floor_level: int | None = 0
    has_elevator: bool | None = False
    profile_pic : str | None = None

    model_config = {"from_attributes": True}

class CreateUserResponse(BaseModel):
    message: str
    data: BaseUser
    
    model_config = {"from_attributes": True}
