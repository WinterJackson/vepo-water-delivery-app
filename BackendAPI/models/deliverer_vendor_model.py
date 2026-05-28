from db.session import Base
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

class VendorRiderStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"

class DelivererVendor(Base):
    __tablename__ = "Deliverer_Vendors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    deliverer_id = Column(UUID(as_uuid=True), ForeignKey("Deliverers.id"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("Vendors.id"), nullable=False, index=True)
    status = Column(Enum(VendorRiderStatus), default=VendorRiderStatus.PENDING, nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=datetime.now(timezone.utc))
    
    # Relationships
    deliverer = relationship("Deliverer", back_populates="vendors")
    vendor = relationship("Vendor", back_populates="deliverers")
