from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from db.session import Base
import uuid

class FailedWebhook(Base):
    __tablename__ = "failed_webhooks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String, nullable=False, default="mpesa")
    payload = Column(Text, nullable=False)
    error_message = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
