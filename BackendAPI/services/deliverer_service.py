import logging
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_
from sqlalchemy.orm import joinedload
from uuid import UUID
from datetime import datetime, timedelta, timezone
from models.deliverer_model import Deliverer
from models.order_model import Order, OrderItem
from models.user_model import User
from models.vendor_model import Vendor
from models.review_model import Review
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from services.expo_push_service import send_push_message
from services.notification_service import create_notification
import asyncio
import h3

logger = logging.getLogger(__name__)


async def get_deliverer_by_clerk_id(session: AsyncSession, clerk_id: str):
    result = await session.execute(
        select(Deliverer).where(Deliverer.clerk_id == clerk_id)
    )
    deliverer = result.scalar_one_or_none()
    
    if not deliverer:
        # Auto-link hack for development: If their Clerk ID changed, re-assign it to the first deliverer
        result_all = await session.execute(select(Deliverer))
        first_d = result_all.scalars().first()
        if first_d:
            first_d.clerk_id = clerk_id
            await session.commit()
            return first_d

    return deliverer


async def register_deliverer(session: AsyncSession, clerk_id: str, data: dict):
    from routes.auth_routes import sanitize_phone_number
    if "phone_number" in data and data["phone_number"]:
         data["phone_number"] = sanitize_phone_number(data["phone_number"])
         
    existing = await get_deliverer_by_clerk_id(session, clerk_id)
    if existing:
        if data.get("phone_number"):
            existing.phone_number = data["phone_number"]
        if data.get("ID_number"):
            existing.ID_number = data["ID_number"]
        if data.get("vehicle_type"):
            existing.vehicle_type = data["vehicle_type"]
        if data.get("plate_number"):
            existing.plate_number = data["plate_number"]
        if data.get("employment_model"):
            existing.employment_model = data["employment_model"]
        if data.get("employer_vendor_id"):
            existing.employer_vendor_id = data["employer_vendor_id"]
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        return existing

    deliverer = Deliverer(
        clerk_id=clerk_id,
        name=data["name"],
        email=data["email"],
        phone_number=data.get("phone_number"),
        ID_number=data.get("ID_number", ""),
        vehicle_type=data.get("vehicle_type", "motorbike"),
        employment_model=data.get("employment_model", "gig_economy"),
        employer_vendor_id=data.get("employer_vendor_id"),
        plate_number=data.get("plate_number"),
        profile_pic=data.get("profile_pic"),
    )
    session.add(deliverer)
    await session.commit()
    await session.refresh(deliverer)
    return deliverer


async def update_deliverer_profile(session: AsyncSession, clerk_id: str, data: dict):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    updatable = ["name", "phone_number", "profile_pic", "vehicle_type", "plate_number",
                 "driver_license", "shift_start", "shift_end", "preferences", "payment_methods"]
    for field in updatable:
        if field in data and data[field] is not None:
            setattr(deliverer, field, data[field])

    # Zone change logic
    if "operation_lat" in data and "operation_lng" in data and data["operation_lat"] is not None and data["operation_lng"] is not None:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        # Reset counter if it's a new month
        if deliverer.last_zone_change:
            if deliverer.last_zone_change.year < now.year or deliverer.last_zone_change.month < now.month:
                deliverer.zone_changes_this_month = 0
                
        if deliverer.zone_changes_this_month >= 2:
            raise HTTPException(status_code=403, detail="You have reached the maximum allowed zone changes (2) for this month.")
            
        deliverer.operation_lat = data["operation_lat"]
        deliverer.operation_lng = data["operation_lng"]
        deliverer.zone_changes_this_month += 1
        deliverer.last_zone_change = now

    await session.commit()
    await session.refresh(deliverer)
    return deliverer


async def update_deliverer_location(session: AsyncSession, clerk_id: str, lat: float, lng: float):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Guard: Reject Null Island (0,0) and clearly invalid coordinates
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0.0 and lng == 0.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates. Null Island (0,0) and out-of-range values are rejected.")

    deliverer.current_lat = lat
    deliverer.current_lng = lng
    deliverer.location = from_shape(Point(lng, lat), srid=4326)
    deliverer.h3_index_res8 = str(h3.latlng_to_cell(lat, lng, 8))
    await session.commit()
    return {"message": "Location updated"}


async def update_deliverer_location_by_id(session: AsyncSession, deliverer_id: str, lat: float, lng: float):
    """Update rider location by UUID (used by WebSocket handler where clerk_id isn't available)."""
    from uuid import UUID as PyUUID
    try:
        uid = PyUUID(deliverer_id)
    except ValueError:
        return {"message": "Invalid deliverer ID"}
    
    deliverer = await session.get(Deliverer, uid)
    if not deliverer:
        return {"message": "Rider not found"}

    # Guard: Reject Null Island (0,0) and clearly invalid coordinates
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0.0 and lng == 0.0):
        return {"message": "Invalid coordinates rejected"}

    deliverer.current_lat = lat
    deliverer.current_lng = lng
    deliverer.location = from_shape(Point(lng, lat), srid=4326)
    deliverer.h3_index_res8 = str(h3.latlng_to_cell(lat, lng, 8))
    await session.commit()
    return {"message": "Location updated via WebSocket"}


async def toggle_availability(session: AsyncSession, clerk_id: str, is_available: bool):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    deliverer.is_available = is_available
    await session.commit()
    return {"message": f"Availability set to {is_available}"}


async def get_deliverer_orders(session: AsyncSession, clerk_id: str, skip: int = 0, limit: int = 50, status: str = None):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    query = (
        select(Order)
        .where(Order.deliverer_id == deliverer.id)
    )
    
    if status:
        query = query.where(Order.order_status == status)

    query = (
        query.options(
            joinedload(Order.order_item).joinedload(OrderItem.product),
            joinedload(Order.vendor),
            joinedload(Order.user)
        )
        .order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(query)
    return result.unique().scalars().all()


async def get_trip_radar_orders(session: AsyncSession, clerk_id: str):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    query = (
        select(Order)
        .where(Order.order_status == "unassigned")
        .options(
            joinedload(Order.order_item).joinedload(OrderItem.product),
            joinedload(Order.vendor),
            joinedload(Order.user)
        )
        .order_by(Order.created_at.desc())
        .limit(20) # Only load recent trip radar items
    )
    result = await session.execute(query)
    return result.unique().scalars().all()


async def update_delivery_status(session: AsyncSession, clerk_id: str, order_id: UUID, new_status: str, proof_url: str | None = None, empties_received: int | None = None):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Your rider account could not be found. Please ensure your profile is fully set up.")

    order = await session.get(Order, order_id)
    if not order or order.deliverer_id != deliverer.id:
        raise HTTPException(status_code=404, detail="This order is no longer assigned to you. It may have been reassigned or cancelled.")

    valid_statuses = ["picked_up", "delivered"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    order.order_status = new_status
    if proof_url:
        from utils.image_utils import validate_proof_url
        if not validate_proof_url(proof_url):
            raise HTTPException(status_code=400, detail="Invalid proof photo URL. Must be a valid Cloudinary image (HTTPS, .webp/.jpg/.png).")
        order.proof_url = proof_url
        
    customer = await session.get(User, order.customer_id)
        
    # --- Delivery Completion Logic ---
    if new_status == "delivered":
        deliverer.is_available = True # F-030: Free the rider for the next order
        
        # For quick_swap: track empties received for operational insight
        if order.delivery_type == "quick_swap":
            received = empties_received or 0
            # If deficit and no proof photo, require evidence
            total_qty = sum(i.quantity for i in (await session.execute(
                select(OrderItem).where(OrderItem.order_id == order.id)
            )).scalars().all()) if not proof_url and received == 0 else received
            
            if received < total_qty and not proof_url:
                raise HTTPException(status_code=400, detail="Proof of delivery photo is mandatory when reporting missing empty bottles.")
        
        # Update customer lifecycle tracking
        if customer:
            # Increment bottle refill count for lifecycle tracking
            if hasattr(customer, 'bottle_refill_count'):
                customer.bottle_refill_count = (customer.bottle_refill_count or 0) + 1
            customer.last_order_date = func.now()
            
            # --- Anti-Poaching Loyalty Cashback ---
            # Lock the customer to the app with a KSh 10 automatic non-withdrawable cashback
            customer.wallet_balance += 10.0
    await session.commit()

    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
            payload={"action": "ORDER_STATUS_UPDATE", "order_id": str(order.id), "status": new_status}
        )
    except Exception as e:
        logger.error(f"WS Broadcast fail: {e}")

    if customer:
        title = "Delivery Update"
        body = f"Your order is now {new_status}!"
        action_url = "/(screens)/Orders"
        await create_notification(
            session=session,
            user_id=customer.id,
            user_type="customer",
            title=title,
            message=body,
            message_type="delivery_update",
            action_url=action_url,
            related_order_id=order.id
        )
        if customer.push_token:
            asyncio.create_task(send_push_message(
                to=customer.push_token,
                title=title,
                body=body,
                data={"url": action_url}
            ))

    return {"message": f"Order status updated to '{new_status}'"}


async def get_deliverer_earnings(session: AsyncSession, clerk_id: str):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_deliveries_q = select(func.count(Order.id)).where(
        and_(Order.deliverer_id == deliverer.id, Order.order_status == "delivered")
    )
    
    last_7_days_deliveries_q = select(func.count(Order.id)).where(
        and_(
            Order.deliverer_id == deliverer.id, 
            Order.order_status == "delivered",
            Order.updated_at >= seven_days_ago
        )
    )

    total_earnings_q = select(func.sum(
        func.coalesce(Order.rider_net, Order.delivery_fee)
    )).where(
        and_(Order.deliverer_id == deliverer.id, Order.order_status == "delivered")
    )

    total_surcharges_q = select(
        func.sum(Order.payload_surcharge).label("total_payload_bonus"),
        func.sum(Order.staircase_surcharge).label("total_staircase_bonus")
    ).where(
        and_(Order.deliverer_id == deliverer.id, Order.order_status == "delivered")
    )

    total_deliveries = (await session.execute(total_deliveries_q)).scalar() or 0
    deliveries_last_7_days = (await session.execute(last_7_days_deliveries_q)).scalar() or 0
    total_earnings = float((await session.execute(total_earnings_q)).scalar() or 0)
    
    surcharges_result = (await session.execute(total_surcharges_q)).first()
    total_payload_bonus = float(surcharges_result.total_payload_bonus or 0.0) if surcharges_result else 0.0
    total_staircase_bonus = float(surcharges_result.total_staircase_bonus or 0.0) if surcharges_result else 0.0

    return {
        "rider_id": str(deliverer.id),
        "name": deliverer.name,
        "total_deliveries": total_deliveries,
        "deliveries_last_7_days": deliveries_last_7_days,
        "total_earnings": total_earnings,
        "is_available": deliverer.is_available,
        "rating": deliverer.rating or 5.0,
        "acceptance_rate": deliverer.acceptance_rate or 100.0,
        "is_platinum": deliverer.is_platinum,
        "total_staircase_bonus": total_staircase_bonus,
        "total_payload_bonus": total_payload_bonus,
    }


async def reject_delivery(session: AsyncSession, clerk_id: str, order_id: UUID):
    """
    Rider rejects an assigned delivery.
    - Validates the rider owns the order and status allows rejection.
    - Unassigns the rider and transitions the order to 'unassigned'.
    - Immediately triggers the reassignment engine to find the next closest rider.
    - Notifies vendor and customer about the reassignment.
    """
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Your rider account could not be found. Please ensure your profile is fully set up.")

    order = await session.get(Order, order_id)
    if not order or order.deliverer_id != deliverer.id:
        raise HTTPException(status_code=404, detail="This order is no longer assigned to you. It may have been reassigned or cancelled.")

    # Only allow rejection for orders that haven't been picked up yet
    rejectable_statuses = ["pending", "accepted", "preparing", "ready"]
    if order.order_status not in rejectable_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject order with status '{order.order_status}'. "
                   f"Only orders in {rejectable_statuses} can be rejected."
        )

    # Unassign rider and transition to unassigned
    previous_rider_id = order.deliverer_id
    order.deliverer_id = None
    order.order_status = "unassigned"
    
    # F-030: Free the rider since they rejected it
    deliverer.is_available = True

    await session.commit()

    # Broadcast the status change via WebSocket
    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(previous_rider_id) if previous_rider_id else "",
            payload={
                "action": "ORDER_STATUS_UPDATE",
                "order_id": str(order.id),
                "status": "unassigned",
                "reason": "rider_rejected",
            }
        )
    except Exception as e:
        logger.error(f"WS Broadcast fail in reject_delivery: {e}")

    # Notify vendor about rider rejection
    from models.vendor_model import Vendor
    vendor = await session.get(Vendor, order.vendor_id)
    if vendor:
        title = "Rider Rejected Delivery 🔄"
        body = "The assigned rider rejected the delivery. We're finding a new rider."
        action_url = "/(screens)/Orders"
        await create_notification(
            session=session,
            user_id=vendor.id,
            user_type="vendor",
            title=title,
            message=body,
            message_type="delivery_update",
            action_url=action_url,
            related_order_id=order.id
        )
        if vendor.push_token:
            asyncio.create_task(send_push_message(
                to=vendor.push_token,
                title=title,
                body=body,
                data={"url": action_url}
            ))

    # Notify customer about reassignment
    customer = await session.get(User, order.customer_id)
    if customer:
        title = "Finding a New Rider 🔄"
        body = "Your delivery is being reassigned to another rider. Hang tight!"
        action_url = "/(screens)/Orders"
        await create_notification(
            session=session,
            user_id=customer.id,
            user_type="customer",
            title=title,
            message=body,
            message_type="delivery_update",
            action_url=action_url,
            related_order_id=order.id
        )
        if customer.push_token:
            asyncio.create_task(send_push_message(
                to=customer.push_token,
                title=title,
                body=body,
                data={"url": action_url}
            ))

    # Immediately attempt reassignment to next closest rider
    reassigned = False
    try:
        from services.order_service import reassign_unassigned_orders
        result = await reassign_unassigned_orders(session=session)
        reassigned = result.get("reassigned", 0) > 0
    except Exception as e:
        logger.error(f"Auto-reassignment after rejection failed: {e}")

    return {
        "message": "Delivery rejected successfully",
        "order_id": str(order.id),
        "reassigned": reassigned,
    }


async def accept_delivery_radar(session: AsyncSession, clerk_id: str, order_id: UUID):
    """
    Rider 'swipes to accept' an order broadcasted via Trip Radar.
    Uses SELECT FOR UPDATE NOWAIT to prevent multiple riders from claiming the same order.
    """
    from sqlalchemy.exc import DBAPIError
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    if not deliverer.is_available:
        raise HTTPException(status_code=400, detail="You must be online and available to accept orders.")

    # Concurrency safe lock with joinedload for anti-fraud checks
    query = select(Order).options(joinedload(Order.user), joinedload(Order.vendor)).where(Order.id == order_id).with_for_update(nowait=True)
    try:
        result = await session.execute(query)
        order = result.scalar_one_or_none()
    except DBAPIError:
        # PostgreSQL raises error if unable to get the lock due to nowait=True
        await session.rollback()
        raise HTTPException(status_code=409, detail="This order has already been claimed by another rider.")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Anti-Fraud: Self-Dealing Prevention
    if order.user and order.user.clerk_id == clerk_id:
        await session.rollback()
        raise HTTPException(status_code=403, detail="Self-dealing prohibited. You cannot deliver your own personal order.")
    if order.vendor and (order.vendor.clerk_id == clerk_id or order.vendor.staff_clerk_id == clerk_id):
        await session.rollback()
        raise HTTPException(status_code=403, detail="Self-dealing prohibited. You cannot deliver for a store you manage.")

    if order.order_status != "unassigned" or order.deliverer_id is not None:
        await session.rollback()
        raise HTTPException(status_code=409, detail="This order has already been claimed by another rider.")

    # Success: Claim the order
    order.deliverer_id = deliverer.id
    order.order_status = "pending"
    deliverer.is_available = False # F-030 Single-Client Constraint Enforcement

    # --- Gamification Ledger Recalculation ---
    # The order was created assuming 10% commission. If this rider is Platinum, reduce to 7%.
    if deliverer.is_platinum and order.rider_commission and order.rider_commission > 0:
        from services.order_service import GIG_PLATINUM_COMMISSION
        new_commission = round(float(order.delivery_fee) * GIG_PLATINUM_COMMISSION, 2)
        commission_diff = float(order.rider_commission) - new_commission
        if commission_diff > 0:
            order.rider_commission = new_commission
            order.rider_net = float(order.rider_net) + commission_diff
            order.platform_total = float(order.platform_total) - commission_diff

    await session.commit()

    # Broadcast Assignment to the group so other riders see it disappear
    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(deliverer.id),
            payload={
                "action": "ORDER_ASSIGNED",
                "order_id": str(order.id),
                "status": "pending",
                "deliverer_id": str(deliverer.id)
            }
        )
    except Exception as e:
        logger.error(f"WS broadcast fail in accept_delivery_radar: {e}")

    return {
        "message": "Delivery claimed successfully!",
        "order_id": str(order.id),
        "delivery_fee": order.delivery_fee
    }


async def report_address_mismatch(session: AsyncSession, clerk_id: str, order_id: UUID):
    """
    Rider reports the customer lied about their floor level.
    Pauses delivery to 'mismatch_pending'. Customer must accept a surcharge or come downstairs.
    """
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    order = await session.get(Order, order_id)
    if not order or order.deliverer_id != deliverer.id:
        raise HTTPException(status_code=404, detail="Order not assigned to you")

    if order.order_status == "delivered":
        raise HTTPException(status_code=400, detail="Order is already delivered")

    order.order_status = "mismatch_pending"
    await session.commit()

    # Trigger a WebSocket broadcast or FCM push notification to the customer here.
    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(order.deliverer_id),
            payload={
                "action": "ORDER_STATUS_UPDATE", 
                "order_id": str(order.id), 
                "status": "mismatch_pending",
                "message": "Rider reported an address mismatch. Please come to the ground floor to pick up your bottles."
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"WebSocket broadcast failed: {e}")

    try:
        from services.notification_service import create_notification
        await create_notification(
            session=session,
            user_id=order.customer_id,
            user_type="customer",
            title="Delivery Paused",
            body="Rider arrived but reported an address mismatch. Please come to the ground floor to pick up your bottles.",
            data={"order_id": str(order.id), "status": "mismatch_pending"}
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Notification creation failed: {e}")

    return {"message": "Mismatch reported. Waiting for customer response.", "status": order.order_status}

async def report_bottle_rejection(session: AsyncSession, clerk_id: str, order_id: UUID, reason_text: str, photo_urls: list[str]):
    from models.bottle_rejection_model import BottleRejectionTicket, RejectionStatus
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    order = await session.get(Order, order_id)
    if not order or order.deliverer_id != deliverer.id:
        raise HTTPException(status_code=404, detail="Order not assigned to you")

    if order.order_status == "delivered":
        raise HTTPException(status_code=400, detail="Order is already delivered")

    rejection = BottleRejectionTicket(
        order_id=order.id,
        rider_id=deliverer.id,
        status=RejectionStatus.PENDING_REVIEW,
        reason_text=reason_text,
        photo_urls=photo_urls
    )
    session.add(rejection)
    
    order.order_status = "pending_review"
    await session.commit()

    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(order.deliverer_id),
            payload={
                "action": "ORDER_STATUS_UPDATE", 
                "order_id": str(order.id), 
                "status": "pending_review",
                "message": "The rider has flagged your empty bottle for review. Please wait 2-5 minutes while admin reviews the photos."
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"WebSocket broadcast failed: {e}")

    return {"message": "Rejection flagged for review. Please wait 2-5 minutes.", "status": order.order_status}

async def get_deliverer_reviews(session: AsyncSession, clerk_id: str):
    deliverer = await get_deliverer_by_clerk_id(session, clerk_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider not found")

    reviews_query = select(Review).where(
        and_(Review.target_type == 'rider', Review.target_id == deliverer.id)
    ).order_by(Review.created_at.desc())

    result = await session.execute(reviews_query)
    reviews = result.scalars().all()

    # Aggregate counts
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    formatted_reviews = []
    
    for r in reviews:
        rating_int = int(round(r.rating))
        if rating_int in distribution:
            distribution[rating_int] += 1
            
        formatted_reviews.append({
            "id": str(r.id),
            "order_id": str(r.order_id),
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

    return {
        "total_reviews": len(reviews),
        "average_rating": deliverer.rating or 5.0,
        "distribution": distribution,
        "reviews": formatted_reviews
    }
