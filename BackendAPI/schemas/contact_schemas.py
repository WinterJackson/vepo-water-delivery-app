from pydantic import BaseModel
from typing import List, Optional

class ContactInfo(BaseModel):
    role: str # "customer", "vendor", or "rider"
    name: str
    phone: str
    vehicle_details: Optional[str] = None
    profile_pic: Optional[str] = None
    
    model_config = {"from_attributes": True}

class OrderContactsResponse(BaseModel):
    contacts: List[ContactInfo]
    
    model_config = {"from_attributes": True}
