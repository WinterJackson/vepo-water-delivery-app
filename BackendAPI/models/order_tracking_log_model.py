from db.session import Base
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, Float, TIMESTAMP, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID

class OrderTrackingLog(Base):
    __tablename__ = "Order_Tracking_Logs"
    __table_args__ = (
        Index('idx_order_tracking_order_id_created', 'order_id', 'created_at'),
    )
    id = Column(UUID(as_uuid=True), unique=True, primary_key=True, default=uuid.uuid4, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("Orders.id", ondelete="CASCADE"), index=True, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    heading = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), index=True)
