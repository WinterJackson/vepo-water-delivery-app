from db.session import Base
from datetime import datetime,timezone
import uuid
from sqlalchemy import Column, String, Text, Boolean,Enum, TIMESTAMP, Float, Double, DateTime,Integer, ARRAY , ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from enum import Enum as PyEnum
from sqlalchemy.orm import relationship


class Notification(Base):
  __tablename__ = "Notifications"
  __table_args__ = (
      Index('idx_notif_user_type_read', 'user_id', 'user_type', 'is_read'),
  )
  id = Column(UUID(as_uuid=True), unique=True, primary_key=True, default=uuid.uuid4, index=True)
  user_id = Column(UUID(as_uuid=True), index=True)
  user_type = Column(String, nullable=False, index=True)
  title = Column(String, nullable=False, index=True)
  message = Column(Text, nullable=False)
  message_type = Column(String, nullable=False, index=True)
  related_order_id = Column(UUID(as_uuid=True), nullable=True, index=True)
  is_read = Column(Boolean, default=False, index=True)
  delivered_via = Column(String, default="app", index=True)
  action_url = Column(String, nullable=True)
  data = Column(JSONB, nullable=True)
  created_at= Column(TIMESTAMP(timezone=True), server_default=func.now())
  updated_at= Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())