from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class PayoutCreate(BaseModel):
    amount: float
    payment_method: str
    account_details: str

class PayoutResponse(BaseModel):
    id: UUID
    provider_id: UUID
    provider_type: str
    amount: float
    status: str
    payment_method: str
    account_details: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class ProviderBalanceResponse(BaseModel):
    lifetime_earnings: float
    pending_payouts: float
    completed_payouts: float
    available_balance: float
