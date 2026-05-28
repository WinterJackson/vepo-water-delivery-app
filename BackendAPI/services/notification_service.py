from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from models.notification_model import Notification
from models.user_model import User
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
import logging

logger = logging.getLogger(__name__)


# ── NOTIF-09 FIX: User ID resolution per entity type ──────────────────────
async def _resolve_user_id(session: AsyncSession, clerk_id: str, user_type: str = "customer"):
    """Resolve database user ID from clerk_id based on entity type."""
    if user_type == "vendor":
        result = await session.execute(select(Vendor).where(Vendor.clerk_id == clerk_id))
        entity = result.scalar_one_or_none()
    elif user_type == "rider":
        result = await session.execute(select(Deliverer).where(Deliverer.clerk_id == clerk_id))
        entity = result.scalar_one_or_none()
    else:
        result = await session.execute(select(User).where(User.clerk_id == clerk_id))
        entity = result.scalar_one_or_none()

    if not entity:
        raise HTTPException(status_code=404, detail=f"{user_type.capitalize()} not found")
    return entity.id


async def get_notifications(session: AsyncSession, clerk_id: str, user_type: str = "customer", skip: int = 0, limit: int = 50):
    """Fetch notifications for any user type (customer, vendor, rider)."""
    user_id = await _resolve_user_id(session, clerk_id, user_type)
    query = (
        select(Notification)
        .where(Notification.user_id == user_id, Notification.user_type == user_type)
        .order_by(desc(Notification.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(query)
    notifications = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "message": n.message,
            "message_type": n.message_type,
            "related_order_id": str(n.related_order_id) if n.related_order_id else None,
            "is_read": n.is_read,
            "delivered_via": n.delivered_via,
            "action_url": n.action_url,
            "data": n.data,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


async def get_unread_count(session: AsyncSession, clerk_id: str, user_type: str = "customer") -> int:
    """Get count of unread notifications for badge display."""
    user_id = await _resolve_user_id(session, clerk_id, user_type)
    from sqlalchemy import func
    result = await session.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user_id, Notification.user_type == user_type, ~Notification.is_read)
    )
    return result.scalar() or 0


async def mark_notification_read(session: AsyncSession, clerk_id: str, notification_id: str, user_type: str = "customer"):
    user_id = await _resolve_user_id(session, clerk_id, user_type)
    result = await session.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await session.commit()
    return {"message": "Marked as read"}


async def mark_all_read(session: AsyncSession, clerk_id: str, user_type: str = "customer"):
    user_id = await _resolve_user_id(session, clerk_id, user_type)
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.user_type == user_type, ~Notification.is_read)
        .values(is_read=True)
    )
    await session.commit()
    return {"message": "Notifications marked as read"}

async def delete_notification(session: AsyncSession, clerk_id: str, notification_id: str, user_type: str = "customer"):
    user_id = await _resolve_user_id(session, clerk_id, user_type)
    result = await session.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    await session.delete(notification)
    await session.commit()
    return {"message": "Notification deleted"}


async def create_notification(
    session: AsyncSession,
    user_id,
    user_type: str,
    title: str,
    message: str,
    message_type: str,
    related_order_id=None,
    delivered_via: str = "push",
    action_url: str = None,
    data: dict = None,
):
    """Create an in-app notification record. Called alongside send_push_message()."""
    try:
        notification = Notification(
            user_id=user_id,
            user_type=user_type,
            title=title,
            message=message,
            message_type=message_type,
            related_order_id=related_order_id,
            delivered_via=delivered_via,
            action_url=action_url,
            data=data,
        )
        session.add(notification)
        # Don't commit here — let the caller's transaction commit handle it
        # This ensures atomicity with the order status update
        await session.flush()
        return notification
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        return None
