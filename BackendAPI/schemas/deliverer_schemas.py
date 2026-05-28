from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Literal, Optional

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
