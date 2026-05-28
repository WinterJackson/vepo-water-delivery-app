from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class ReviewCreate(BaseModel):
    order_id: UUID
    target_type: str = Field(..., pattern="^(vendor|rider)$")
    target_id: UUID
    rating: float = Field(..., ge=1.0, le=5.0)
    comment: Optional[str] = None

class ReviewOut(BaseModel):
    id: UUID
    order_id: UUID
    customer_clerk_id: str
    target_type: str
    target_id: UUID
    rating: float
    comment: Optional[str]
    created_at: datetime
    
    model_config = {"from_attributes": True}
