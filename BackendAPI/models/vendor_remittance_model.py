from db.session import Base
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Numeric, TIMESTAMP, ForeignKey, func, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum as PyEnum
from sqlalchemy.orm import relationship

class VendorRemittanceStatus(str, PyEnum):
    OPEN = "open"
    SETTLED = "settled"
    DISCREPANCY = "discrepancy"

class VendorRemittance(Base):
    __tablename__ = "vendor_remittances"
    __table_args__ = (
        Index('idx_vendor_remittance_deliverer_created', 'deliverer_id', 'created_at'),
        Index('idx_vendor_remittance_vendor_created', 'vendor_id', 'created_at'),
    )
    id = Column(UUID(as_uuid=True), unique=True, primary_key=True, default=uuid.uuid4, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("Vendors.id"), index=True)
    deliverer_id = Column(UUID(as_uuid=True), ForeignKey("Deliverers.id"), index=True)
    
    full_bottles_out = Column(Integer, nullable=False, default=0)
    full_bottles_returned = Column(Integer, nullable=False, default=0)
    empty_bottles_collected = Column(Integer, nullable=False, default=0)
    
    cash_expected = Column(Numeric(10, 2), nullable=False, default=0)
    cash_collected = Column(Numeric(10, 2), nullable=False, default=0)
    
    status = Column(Enum(VendorRemittanceStatus), default=VendorRemittanceStatus.OPEN)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=datetime.now(timezone.utc))

    # Relationships can be dynamically loaded or added to the other models
