from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Enum, text, func, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime
from db.session import Base

class Payout(Base):
    __tablename__ = "payouts"
    __table_args__ = (
        Index('idx_payout_provider_created', 'provider_id', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Can be Vendor ID or Deliverer ID
    provider_type = Column(String(50), nullable=False)  # "vendor" or "rider"
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    payment_method = Column(String(100), nullable=False)  # E.g., "mpesa"
    account_details = Column(String(255), nullable=False)  # Phone number, bank account, etc.
    conversation_id = Column(String(255), nullable=True, index=True)  # M-Pesa B2C ConversationID
    mpesa_receipt = Column(String(255), nullable=True, index=True)  # M-Pesa B2C receipt number
    failure_reason = Column(String(500), nullable=True)  # Reason for failure if applicable
    idempotency_key = Column(String(255), nullable=True, unique=True, index=True) # For UI/UX duplicate prevention
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.now(datetime.timezone.utc))
