"""F-016 FIX: Real Payment/Transaction model for audit trail."""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from db.session import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("Orders.id"), nullable=True, index=True)
    checkout_request_id = Column(String, nullable=False, unique=True, index=True)
    mpesa_receipt = Column(String, nullable=True, index=True)  # MpesaReceiptNumber from callback
    reversal_conversation_id = Column(String, nullable=True, index=True)  # M-Pesa Reversal ConversationID
    phone = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, paid, failed, refunded
    failure_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
