import logging
import math
from enum import Enum as PyEnum
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
from uuid import UUID
from sqlalchemy import select, and_, update
from sqlalchemy.orm import joinedload
from fastapi import HTTPException
from geoalchemy2.functions import ST_Distance
from models.cart_model import CartItem
from models.deliverer_model import Deliverer
from models.product_model import Product
from models.order_model import Order, OrderItem
from models.vendor_model import Vendor
from models.user_model import User
from schemas.order_schema import BaseOrder
from services.expo_push_service import send_push_message
from services.notification_service import create_notification
from services.dispatch_policy import DispatchPolicy
import asyncio

EARTH_RADIUS_KM = 6371.0
MINUTES_PER_KM = 3.0  # Average bike speed in Nairobi urban traffic

logger = logging.getLogger(__name__)


# ── F-029 FIX: Order Status Enum & State Machine ────────────────────────────
class OrderStatusEnum(str, PyEnum):
    PENDING = "pending"
    UNASSIGNED = "unassigned"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    READY = "ready"
    PICKED_UP = "picked_up"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    PENDING_REVIEW = "pending_review"
    MISMATCH_PENDING = "mismatch_pending"

# Valid transitions: from_status -> allowed_to_statuses
VALID_TRANSITIONS = {
    OrderStatusEnum.PENDING: {OrderStatusEnum.ACCEPTED, OrderStatusEnum.REJECTED, OrderStatusEnum.CANCELLED, OrderStatusEnum.UNASSIGNED},
    OrderStatusEnum.UNASSIGNED: {OrderStatusEnum.PENDING, OrderStatusEnum.CANCELLED},
    OrderStatusEnum.ACCEPTED: {OrderStatusEnum.PREPARING, OrderStatusEnum.CANCELLED},
    OrderStatusEnum.PREPARING: {OrderStatusEnum.READY, OrderStatusEnum.CANCELLED},
    OrderStatusEnum.READY: {OrderStatusEnum.PICKED_UP},
    OrderStatusEnum.PICKED_UP: {OrderStatusEnum.DELIVERED, OrderStatusEnum.PENDING_REVIEW, OrderStatusEnum.MISMATCH_PENDING},
    OrderStatusEnum.PENDING_REVIEW: {OrderStatusEnum.PICKED_UP, OrderStatusEnum.DELIVERED},
    OrderStatusEnum.MISMATCH_PENDING: {OrderStatusEnum.DELIVERED},
    OrderStatusEnum.DELIVERED: set(),  # Terminal state
    OrderStatusEnum.CANCELLED: set(),  # Terminal state
    OrderStatusEnum.REJECTED: set(),   # Terminal state
}

def validate_status_transition(current: str, new: str) -> bool:
    """Returns True if the transition is valid per the state machine."""
    try:
        current_enum = OrderStatusEnum(current)
        new_enum = OrderStatusEnum(new)
    except ValueError:
        return False
    return new_enum in VALID_TRANSITIONS.get(current_enum, set())

# Revenue split constants
RETAIL_VENDOR_COMMISSION = 0.05   # 5% of product price
WHOLESALE_VENDOR_COMMISSION = 0.025  # 2.5% of product price
RETAIL_SERVICE_FEE_KSH = 12.0    # Flat service fee for retail orders
WHOLESALE_SERVICE_FEE_KSH = 50.0
GIG_RIDER_COMMISSION = 0.10       # 10% of delivery fee
GIG_PLATINUM_COMMISSION = 0.07    # 7% of delivery fee for Platinum riders
IN_HOUSE_RIDER_COMMISSION = 0.0   # 0% — vendor owns the fleet
WHOLESALE_DELIVERY_MARKUP = 0.05  # 5% platform surcharge on wholesale delivery fees
SURGE_FEE_KSH = 10.0             # KSH 10 surcharge during peak hours

# Peak hour windows (Nairobi local time)
PEAK_HOURS = [(6, 8), (17, 19)]   # 6:00-8:00 AM and 5:00-7:00 PM


def is_surge_active() -> bool:
    """Check if current Nairobi time falls within peak hours."""
    from datetime import datetime, timezone, timedelta
    nairobi_tz = timezone(timedelta(hours=3))  # EAT = UTC+3
    now = datetime.now(nairobi_tz)
    current_hour = now.hour
    return any(start <= current_hour < end for start, end in PEAK_HOURS)

def _haversine_km(lat_from: float, lng_from: float, lat_to: float, lng_to: float) -> float:
    """Pure Haversine distance in km between two GPS points."""
    d_lat = math.radians(lat_to - lat_from)
    d_lng = math.radians(lng_to - lng_from)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat_from)) * math.cos(math.radians(lat_to)) *
         math.sin(d_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(EARTH_RADIUS_KM * c, 2)


def calculate_cart_payload(items) -> dict:
    """Sum the total weight of all cart items to determine required vehicle class.
    Returns { 'total_weight_kg': float, 'required_vehicle': str, 'total_quantity': int }
    """
    total_weight_kg = 0.0
    total_quantity = 0
    for item in items:
        product = item.product
        total_quantity += item.quantity
        if product and hasattr(product, 'weight_kg'):
            total_weight_kg += float(product.weight_kg) * item.quantity

    if total_weight_kg > 0:
        if total_weight_kg <= 100.0:
            required_vehicle = "motorbike"
        elif total_weight_kg <= 400.0:
            required_vehicle = "tuktuk"
        else:
            required_vehicle = "truck"
    else:
        # Fallback to quantity based capacity logic from DispatchPolicy
        required_vehicle = DispatchPolicy.get_vehicle_class(total_quantity)

    return {"total_weight_kg": round(total_weight_kg, 2), "required_vehicle": required_vehicle, "total_quantity": total_quantity}


def calculate_delivery_fee(
    lat_from: float, lng_from: float,
    lat_to: float, lng_to: float,
    vendor_type: str = "retail_refill",
    vehicle_class: str = "motorbike",
    wholesale_base: float = 0.0,
    wholesale_per_km: float = 0.0,
    delivery_type: str = "quick_swap"
) -> dict:
    """Returns { 'distance_km': float, 'fee': float, 'estimated_minutes': int, 'vehicle_class': str }"""
    if not all([lat_from, lng_from, lat_to, lng_to]):
        return {"distance_km": 0.0, "fee": DispatchPolicy.get_delivery_fee(0.0, vendor_type, vehicle_class, wholesale_base, wholesale_per_km, delivery_type), "estimated_minutes": 15, "vehicle_class": vehicle_class}

    distance_km = _haversine_km(lat_from, lng_from, lat_to, lng_to)
    fee = DispatchPolicy.get_delivery_fee(distance_km, vendor_type, vehicle_class, wholesale_base, wholesale_per_km, delivery_type)
    estimated_minutes = max(5, int(math.ceil(distance_km * MINUTES_PER_KM)))

    return {
        "distance_km": distance_km,
        "fee": fee,
        "estimated_minutes": estimated_minutes,
        "vehicle_class": vehicle_class,
    }


def calculate_revenue_splits(
    product_total: float,
    delivery_fee: float,
    vendor_type: str = "retail_refill",
    bottle_deposit: float = 0.0,
    rider_surcharges: float = 0.0,
    delivery_type: str = "quick_swap",
    welcome_discount: float = 0.0
) -> dict:
    """Calculate platform revenue splits for a single order.
    FIN-01 FIX: Uses Decimal for currency precision to prevent ledger drift.
    Returns { 'vendor_commission', 'service_fee', 'rider_commission', 'platform_total',
              'vendor_net', 'rider_net', 'surge_fee', 'delivery_markup' }
    """
    from decimal import Decimal, ROUND_HALF_UP

    # Convert all inputs to Decimal
    _pt = Decimal(str(product_total))
    _df = Decimal(str(delivery_fee))
    _bd = Decimal(str(bottle_deposit))
    _rs = Decimal(str(rider_surcharges))
    _wd = Decimal(str(welcome_discount))

    TWO = Decimal("0.01")

    # ── Vendor Commission ──
    if vendor_type == "wholesale_b2b":
        vendor_commission = (_pt * Decimal(str(WHOLESALE_VENDOR_COMMISSION))).quantize(TWO, rounding=ROUND_HALF_UP)
        service_fee = Decimal(str(WHOLESALE_SERVICE_FEE_KSH))
    else:
        vendor_commission = (_pt * Decimal(str(RETAIL_VENDOR_COMMISSION))).quantize(TWO, rounding=ROUND_HALF_UP)
        service_fee = Decimal(str(RETAIL_SERVICE_FEE_KSH))

    # ── Rider Commission (Gig only; wholesale in-house is exempt) ──
    if vendor_type == "wholesale_b2b":
        rider_commission = Decimal("0.00")
    else:
        # M-09 FIX: Reference the module-level constants instead of inline values
        # keep_my_bottle adds 2% premium (12% vs 10%) for extra bottle handling
        if delivery_type == "keep_my_bottle":
            commission_rate = Decimal(str(GIG_RIDER_COMMISSION)) + Decimal("0.02")
        else:
            commission_rate = Decimal(str(GIG_RIDER_COMMISSION))
        rider_commission = (_df * commission_rate).quantize(TWO, rounding=ROUND_HALF_UP)

    # ── Wholesale Delivery Markup (5% surcharge on delivery fee) ──
    if vendor_type == "wholesale_b2b":
        delivery_markup = (_df * Decimal(str(WHOLESALE_DELIVERY_MARKUP))).quantize(TWO, rounding=ROUND_HALF_UP)
    else:
        delivery_markup = Decimal("0.00")

    # ── Surge Pricing (KSH 10 during peak hours) ──
    surge_fee = Decimal(str(SURGE_FEE_KSH)) if is_surge_active() else Decimal("0.00")

    # ── Platform Total Revenue ──
    # Platform absorbs the welcome discount as a customer acquisition cost
    platform_total = (vendor_commission + service_fee + rider_commission + delivery_markup + surge_fee - _wd).quantize(TWO, rounding=ROUND_HALF_UP)

    # ── Net Payouts ──
    # Wholesale vendors get delivery fee back (they own the fleet)
    if vendor_type == "wholesale_b2b":
        vendor_net = (_pt - vendor_commission + _df + _bd).quantize(TWO, rounding=ROUND_HALF_UP)
    else:
        vendor_net = (_pt - vendor_commission + _bd).quantize(TWO, rounding=ROUND_HALF_UP)

    rider_net = (_df - rider_commission + _rs).quantize(TWO, rounding=ROUND_HALF_UP)

    return {
        "vendor_commission": float(vendor_commission),
        "service_fee": float(service_fee),
        "rider_commission": float(rider_commission),
        "platform_total": float(platform_total),
        "vendor_net": float(vendor_net),
        "rider_net": float(rider_net),
        "surge_fee": float(surge_fee),
        "delivery_markup": float(delivery_markup),
    }


async def get_radar_deliverers(session: AsyncSession, lat: float, lng: float, vendor_id: UUID = None, vehicle_class: str = "motorbike", vendor_type: str = "retail_refill"):
  """Find the closest available deliverers within precise delivery bounds.
  Uses high-level dynamic k-ring bounds coupled with exact ST_Distance geographic clipping."""
  from models.vendor_rider_model import VendorRiderRegistry
  from models.deliverer_model import RiderVehicleType
  from geoalchemy2.shape import from_shape
  from shapely.geometry import Point
  import h3
  
  try:
      vehicle_enum = RiderVehicleType(vehicle_class)
  except ValueError:
      vehicle_enum = RiderVehicleType.motorbike
      
  # 1. Parameterize limits
  max_distance_m = DispatchPolicy.get_max_distance_m(vendor_type, action="rider_search")
      
  # 2. H3 pre-filter for indexed speed
  center_hex = h3.latlng_to_cell(lat, lng, 8)
  k_ring = DispatchPolicy.get_h3_k_ring(vendor_type)
  nearby_hexes = [str(h) for h in h3.grid_disk(center_hex, k_ring)]

  # 3. Fast Euclidean Post-Filter
  pickup_point = from_shape(Point(lng, lat), srid=4326)

  query = select(Deliverer, Deliverer.push_token, Deliverer.id.label("user_id")).where(
      and_(
          Deliverer.is_available, 
          Deliverer.employment_model == "gig_economy",  # Tier 2 is restricted to Gig-Economy
          Deliverer.vehicle_type == vehicle_enum, 
          Deliverer.h3_index_res8.in_(nearby_hexes),
          Deliverer.location.isnot(None),
          ST_Distance(Deliverer.location, pickup_point) <= max_distance_m
      )
  )
  
  if vendor_id:
      query = query.join(VendorRiderRegistry, VendorRiderRegistry.rider_id == Deliverer.id).where(
          and_(VendorRiderRegistry.vendor_id == vendor_id, VendorRiderRegistry.status == "approved")
      )

  result = await session.execute(query)
  deliverers = result.all()
  return deliverers


async def get_closest_deliverer(session: AsyncSession, lat: float, lng: float, vendor_id: UUID = None, vehicle_class: str = "motorbike", vendor_type: str = "retail_refill"):
  """Find the single nearest available rider using PostGIS ST_Distance.
  Filtered by vehicle_class to match the order's payload requirements.
  Falls back to H3 grid_disk search, then to raw distance-based global scan."""
  from models.vendor_rider_model import VendorRiderRegistry
  from models.deliverer_model import RiderVehicleType
  from geoalchemy2.shape import from_shape
  from shapely.geometry import Point
  import h3

  pickup_point = from_shape(Point(lng, lat), srid=4326)

  try:
      vehicle_enum = RiderVehicleType(vehicle_class)
  except ValueError:
      vehicle_enum = RiderVehicleType.motorbike

  max_distance_m = DispatchPolicy.get_max_distance_m(vendor_type, action="rider_search")

  # Step 1: Try H3 grid_disk neighbors first (fast indexed lookup)
  center_hex = h3.latlng_to_cell(lat, lng, 8)
  k_ring = DispatchPolicy.get_h3_k_ring(vendor_type)
  nearby_hexes = [str(h) for h in h3.grid_disk(center_hex, k_ring)]

  query = (
      select(Deliverer)
      .where(
          and_(
              Deliverer.is_available,
              Deliverer.vehicle_type == vehicle_enum,
              Deliverer.h3_index_res8.in_(nearby_hexes),
              Deliverer.location.isnot(None),
              ST_Distance(Deliverer.location, pickup_point) <= max_distance_m,
          )
      )
      .order_by(ST_Distance(Deliverer.location, pickup_point))
      .limit(1)
  )

  if vendor_id:
      query = query.join(VendorRiderRegistry, VendorRiderRegistry.rider_id == Deliverer.id).where(
          and_(VendorRiderRegistry.vendor_id == vendor_id, VendorRiderRegistry.status == "approved")
      )

  result = await session.execute(query)
  deliverer = result.scalar_one_or_none()

  if deliverer:
      return deliverer

  # Step 2: Fallback — global scan (no H3 filter) within max allowed distance
  fallback_query = (
      select(Deliverer)
      .where(
          and_(
              Deliverer.is_available,
              Deliverer.vehicle_type == vehicle_enum,
              Deliverer.location.isnot(None),
              ST_Distance(Deliverer.location, pickup_point) <= max_distance_m,
          )
      )
      .order_by(ST_Distance(Deliverer.location, pickup_point))
      .limit(1)
  )

  if vendor_id:
      fallback_query = fallback_query.join(VendorRiderRegistry, VendorRiderRegistry.rider_id == Deliverer.id).where(
          and_(VendorRiderRegistry.vendor_id == vendor_id, VendorRiderRegistry.status == "approved")
      )

  result = await session.execute(fallback_query)
  return result.scalar_one_or_none()


# ── V6: 20-Second Tiered Dispatch Engine ───────────────────────────────────
# Tier 1 (0-20s):  Push exclusively to pre-approved riders from VendorRiderRegistry
# Tier 2 (20s+):   Escalate to full Trip Radar broadcast to ALL nearby H3 riders
# ───────────────────────────────────────────────────────────────────────────

DISPATCH_TIER1_TIMEOUT_SECONDS = 20

async def dispatch_order_to_riders(
    order_id: UUID,
    vendor_id: UUID,
    customer_id: UUID,
    lat: float,
    lng: float,
    delivery_fee: float,
    vehicle_class: str = "motorbike",
    vendor_type: str = "retail_refill",
    total_weight_kg: float = 0.0,
    total_quantity: int = 0,
    delivery_type: str = "quick_swap",
    notification_data: dict = None,
):
    """Background async task: implements the 20-second tiered dispatch escalation.

    Tier 1 — Push to pre-approved riders from VendorRiderRegistry.
             Wait 20 seconds for one of them to accept.
    Tier 2 — If the order is still unassigned after 20s, escalate to the
             Trip Radar broadcast targeting ALL H3-nearby riders with matching vehicle type.
    """
    from dependencies.dependencies import get_db_session
    from models.vendor_rider_model import VendorRiderRegistry
    from models.deliverer_model import RiderVehicleType

    try:
        vehicle_enum = RiderVehicleType(vehicle_class)
    except ValueError:
        vehicle_enum = RiderVehicleType.motorbike

    # ── TIER 1: Pre-Approved Vendor Riders ──────────────────────────────
    try:
        async with get_db_session() as session:
            # Fetch up to 10 pre-approved riders for this vendor with matching vehicle type
            tier1_query = (
                select(Deliverer, Deliverer.push_token, Deliverer.id.label("user_id"))
                .join(VendorRiderRegistry, VendorRiderRegistry.rider_id == Deliverer.id)
                .where(
                    and_(
                        VendorRiderRegistry.vendor_id == vendor_id,
                        VendorRiderRegistry.status == "approved",
                        Deliverer.is_available,
                        Deliverer.vehicle_type == vehicle_enum,
                    )
                )
                .limit(10)
            )
            result = await session.execute(tier1_query)
            tier1_riders = result.all()

            tier1_count = len(tier1_riders)
            logger.info(f"Dispatch Tier 1: Found {tier1_count} pre-approved riders for order {order_id}")

            if tier1_count > 0:
                title = "New Delivery from Your Vendor! 📦"
                body = f"Ksh {delivery_fee:.0f} Fee | {total_quantity} items ({total_weight_kg}kg). Tap to accept."
                action_url = "/(screens)/Orders"

                for rider_obj, p_token, uid in tier1_riders:
                    await create_notification(
                        session=session,
                        user_id=uid,
                        user_type="rider",
                        title=title,
                        message=body,
                        message_type="new_delivery",
                        action_url=action_url,
                        related_order_id=order_id,
                        data=notification_data
                    )
                    if p_token:
                        asyncio.create_task(send_push_message(
                            to=p_token, title=title, body=body,
                            data={"url": action_url}
                        ))

                # WebSocket event to rider apps
                try:
                    from routes.websocket_routes import manager
                    rider_ids = [str(uid) for _, _, uid in tier1_riders]
                    await manager.broadcast_to_riders(
                        rider_ids=rider_ids,
                        payload={
                            "action": "NEW_DELIVERY_OFFER",
                            "order_id": str(order_id),
                            "fee": delivery_fee,
                            "tier": 1,
                            "weight_kg": total_weight_kg,
                            "quantity": total_quantity,
                            "delivery_type": delivery_type,
                        }
                    )
                except Exception as e:
                    logger.error(f"Dispatch Tier 1 WS fail: {e}")

                await session.commit()

    except Exception as e:
        logger.error(f"Dispatch Tier 1 error for order {order_id}: {e}")

    # ── WAIT 20 SECONDS ────────────────────────────────────────────────
    await asyncio.sleep(DISPATCH_TIER1_TIMEOUT_SECONDS)

    # ── TIER 2: Trip Radar Broadcast (only if still unassigned) ─────────
    # If Wholesale B2B, DO NOT broadcast to Trip Radar (Gig-Economy bypassed)
    if vendor_type == "wholesale_b2b":
        logger.info(f"Dispatch Tier 2: Bypassing Trip Radar for Wholesale Order {order_id}")
        return

    try:
        async with get_db_session() as session:
            # Re-check order status — someone may have accepted during the 20s window
            order_check = await session.get(Order, order_id)
            if not order_check:
                logger.warning(f"Dispatch Tier 2: Order {order_id} not found, aborting.")
                return
            if order_check.order_status != "unassigned" or order_check.deliverer_id is not None:
                logger.info(f"Dispatch Tier 2: Order {order_id} already claimed. Skipping broadcast.")
                return

            # Fetch ALL nearby riders via H3 (not just vendor-approved ones)
            radar_riders = await get_radar_deliverers(
                session=session, lat=lat, lng=lng,
                vendor_id=None,  # No vendor filter — open to all nearby riders
                vehicle_class=vehicle_class,
            )

            tier2_count = len(radar_riders)
            logger.info(f"Dispatch Tier 2: Broadcasting to {tier2_count} Trip Radar riders for order {order_id}")

            if tier2_count > 0:
                title = "Trip Radar: New Delivery! 📦"
                body = f"Ksh {delivery_fee:.0f} Fee | {total_quantity} items ({total_weight_kg}kg). Tap to accept."
                action_url = "/(screens)/Orders"

                for rider_obj, p_token, uid in radar_riders:
                    await create_notification(
                        session=session,
                        user_id=uid,
                        user_type="rider",
                        title=title,
                        message=body,
                        message_type="new_delivery",
                        action_url=action_url,
                        related_order_id=order_id,
                        data=notification_data
                    )
                    if p_token:
                        asyncio.create_task(send_push_message(
                            to=p_token, title=title, body=body,
                            data={"url": action_url}
                        ))

                # Trip Radar WebSocket event
                try:
                    from routes.websocket_routes import manager
                    rider_ids = [str(uid) for _, _, uid in radar_riders]
                    await manager.broadcast_to_riders(
                        rider_ids=rider_ids,
                        payload={
                            "action": "TRIP_RADAR_BROADCAST",
                            "order_id": str(order_id),
                            "fee": delivery_fee,
                            "tier": 2,
                            "weight_kg": total_weight_kg,
                            "quantity": total_quantity,
                            "delivery_type": delivery_type,
                        }
                    )
                except Exception as e:
                    logger.error(f"Dispatch Tier 2 WS fail: {e}")

                await session.commit()
            else:
                logger.warning(f"Dispatch Tier 2: No riders found for order {order_id}. Order remains unassigned.")

    except Exception as e:
        logger.error(f"Dispatch Tier 2 error for order {order_id}: {e}")


async def create_order(session: AsyncSession, CheckoutRequestID: str | None, id: UUID, user_id: UUID, phone: str, type: str, lat: float, lng: float, delivery_type: str = "quick_swap", payment_method: str = "mpesa"):
  # --- Idempotency Guard: Prevent duplicate STK push double-charges ---
  if CheckoutRequestID:
      existing_order = await session.execute(
          select(Order).where(Order.checkout_request_ID == CheckoutRequestID).limit(1)
      )
      if existing_order.scalar_one_or_none():
          raise HTTPException(
              status_code=409,
              detail="This payment request has already been processed. Please refresh your orders."
          )

  # --- Debt Intercept: Block checkout if customer has outstanding bottle debts ---
  user_check = await session.get(User, user_id)
  if user_check and float(user_check.debt_balance) > 0:
      raise HTTPException(
          status_code=402,
          detail=f"You have an outstanding bottle deposit debt of KSH {float(user_check.debt_balance):.0f}. Please clear it before placing a new order."
      )

  if type == "cart":
    query = select(CartItem).where(CartItem.cart_id == id).options(joinedload(CartItem.vendor), joinedload(CartItem.product))
    result = await session.execute(query)
    items = result.unique().scalars().all()
    grouped_items = defaultdict(list)
    for item in items:
      grouped_items[item.vendor_id].append(item)
    
    for vendor_id, pre_order_items in grouped_items.items():
      # --- Stock Validation ---
      for item in pre_order_items:
        product = item.product
        if not product or product.stock < item.quantity:
          raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for product '{product.name if product else 'unknown'}'. Available: {product.stock if product else 0}, Requested: {item.quantity}"
          )

      # --- V6: Payload & Vehicle Class Determination ---
      payload_info = calculate_cart_payload(pre_order_items)
      required_vehicle = payload_info["required_vehicle"]
      total_weight_kg = payload_info["total_weight_kg"]
      total_quantity = payload_info["total_quantity"]

      first_item = pre_order_items[0]
      lat_from = first_item.vendor.lat
      lng_from = first_item.vendor.lng
      vendor = await session.get(Vendor, vendor_id)
      vendor_type_str = vendor.vendor_type.value if vendor and vendor.vendor_type else "retail_refill"
      
      # --- Anti-Fraud: Self-Dealing Prevention ---
      if user_check and vendor and (user_check.clerk_id == vendor.clerk_id or user_check.clerk_id == vendor.staff_clerk_id):
          raise HTTPException(
              status_code=403,
              detail="Self-dealing prohibited. You cannot place an order from your own store."
          )

      # --- V6: Wholesale MOQ Enforcement ---
      if vendor_type_str == "wholesale_b2b" and total_weight_kg < DispatchPolicy.WHOLESALE_MOQ_KG:
          raise HTTPException(
              status_code=400,
              detail=f"Wholesale orders require a minimum of {DispatchPolicy.WHOLESALE_MOQ_KG}kg (~5 bottles). Current cart weight: {total_weight_kg}kg."
          )

      # --- V6: Tiered Delivery Fee Calculation ---
      delivery = calculate_delivery_fee(
          lat_from, lng_from, lat, lng,
          vendor_type=vendor_type_str,
          vehicle_class=required_vehicle,
          delivery_type=delivery_type
      )

      # --- V6: Distance Guard (Retail Only) ---
      if vendor_type_str == "retail_refill":
          max_distance = DispatchPolicy.RETAIL_MAX_DISTANCE_KM
          if delivery["distance_km"] > max_distance:
              raise HTTPException(
                  status_code=400,
                  detail=f"Delivery address ({delivery['distance_km']} km) exceeds the {max_distance} km maximum for retail orders."
              )

      import h3
      order_h3_index = h3.latlng_to_cell(lat, lng, 8)

      # --- Welcome Offer (First-Bottle Injection & 30% Discount) ---
      user = await session.get(User, user_id)
      total_quantity = sum(item.quantity for item in pre_order_items)
      
      welcome_discount = 0.0
      bottle_fee_total = 0.0
      is_welcome = False
      
      # 1. Determine if customer needs to pay bottle deposit.
      # Deposit is required if they selected "keep_my_bottle" OR if it's their first order (no empty bottles to swap).
      is_first_order = user and not getattr(user, 'has_used_welcome_offer', True)
      
      if delivery_type == "keep_my_bottle" or is_first_order:
          highest_bottle_price = 0.0
          for item in pre_order_items:
              product = item.product
              if product:
                  capacity = getattr(product, 'capacity', 0)
                  if capacity == 20:
                      bottle_fee_total += 300.0 * item.quantity
                      highest_bottle_price = max(highest_bottle_price, 300.0)
                  elif capacity == 10:
                      bottle_fee_total += 150.0 * item.quantity
                      highest_bottle_price = max(highest_bottle_price, 150.0)
          
          # 2. Apply Welcome Discount ONLY if it's their first order and they are paying a bottle fee
          if is_first_order and highest_bottle_price > 0:
              # C-05 FIX: Welcome discount is 30% of the total BOTTLE DEPOSIT
              welcome_discount = round(bottle_fee_total * 0.30, 2)
              is_welcome = True
              user.has_used_welcome_offer = True
              logger.info(f"Welcome Offer applied for user {user_id}: KSH {welcome_discount:.0f} off on bottle fee of {bottle_fee_total}")

      # --- Surcharge Logic (Anti-Fraud) ---
      payload_surcharge = 0.0
      staircase_surcharge = 0.0

      if total_quantity > 2:
          payload_surcharge = float((total_quantity - 2) * 10.0)

      if user:
          floor_level = getattr(user, 'floor_level', 0)
          has_elevator = getattr(user, 'has_elevator', False)
          if floor_level > 2 and not has_elevator:
                staircase_surcharge = float((floor_level - 2) * 10.0)

      total_rider_surcharges = payload_surcharge + staircase_surcharge

      # --- V6: Revenue Split Calculation ---
      product_total = float(sum(item.Subtotal for item in pre_order_items))
      revenue = calculate_revenue_splits(
          product_total=product_total,
          delivery_fee=delivery["fee"],
          vendor_type=vendor_type_str,
          bottle_deposit=bottle_fee_total, # Pass bottle fee to vendor without commission deduction
          rider_surcharges=total_rider_surcharges,
          delivery_type=delivery_type,
          welcome_discount=welcome_discount # Platform absorbs the discount
      )

      # --- Trip Radar Broadcast Logic ---
      # Rider is no longer direct assigned. Order stays unassigned.
      deliverer_id = None
      initial_status = "unassigned"

      # C-04 FIX: Compute the FULL pre-discount total including bottle fees.
      # Bottle deposit fees are charged to the customer and credited to the vendor.
      pre_discount_total = (
          float(product_total) + delivery["fee"] + revenue["service_fee"] +
          revenue["surge_fee"] + revenue["delivery_markup"] +
          total_rider_surcharges + bottle_fee_total
      )

      # H-06 FIX: Apply welcome_discount FIRST (it reduces the bottle fee component),
      # then calculate wallet_discount on the remaining total. This prevents the wallet
      # from over-discounting when both are active.
      after_welcome = pre_discount_total - welcome_discount

      # --- Wallet Discount ---
      wallet_discount = 0.0
      if user and getattr(user, 'wallet_balance', 0) > 0:
          # Ensure at least KSh 1 remains after all discounts (prevents zero-amount orders)
          max_discount = max(0.0, after_welcome - 1.0)
          wallet_discount = min(float(user.wallet_balance), max_discount)
          # Deduct only what we used
          user.wallet_balance = float(user.wallet_balance) - wallet_discount

      final_total = after_welcome - wallet_discount

      order = Order(
        customer_id = user_id,
        vendor_id = vendor_id,
        checkout_request_ID = CheckoutRequestID,
        deliverer_id = deliverer_id,
        order_status = initial_status,
        lat_from = lat_from,
        lng_from = lng_from,
        lat = lat,
        lng = lng,
        h3_index_res8 = str(order_h3_index),
        distance_km = delivery["distance_km"],
        phone = phone,
        delivery_address = user.location_address if user else None,
        total_amount = final_total,
        delivery_fee = delivery["fee"],
        
        # ── Surcharges ──
        staircase_surcharge = staircase_surcharge,
        payload_surcharge = payload_surcharge,

        # ── Revenue Split Ledger ──
        vendor_commission = revenue["vendor_commission"],
        service_fee = revenue["service_fee"],
        rider_commission = revenue["rider_commission"],
        platform_total = revenue["platform_total"],
        vendor_net = revenue["vendor_net"],
        rider_net = revenue["rider_net"],
        surge_fee = revenue["surge_fee"],
        delivery_markup = revenue["delivery_markup"],
        vehicle_class = required_vehicle,
        delivery_time = delivery["estimated_minutes"],
        is_welcome_offer = is_welcome,
        delivery_type=delivery_type,
        bottle_source="platform" if is_welcome else "own",
        payment_method=payment_method,

        # ── H-07 FIX: Discount Audit Trail ──
        wallet_discount = wallet_discount,
        welcome_discount = welcome_discount,
        product_subtotal = float(product_total),
      )
      session.add(order)
      await session.flush()
      
      for item in pre_order_items:
        order_item = OrderItem(
          order_id = order.id,
          product_id = item.product_id,
          quantity = item.quantity,
          price = item.price,
          Subtotal = item.Subtotal
        )
        session.add(order_item)

        # --- F-004 FIX: Atomic Stock Decrement ---
        # Uses SQL UPDATE...WHERE stock >= qty to prevent overselling
        # If rows_affected == 0, another transaction already depleted stock
        result = await session.execute(
            update(Product)
            .where(Product.id == item.product_id, Product.stock >= item.quantity)
            .values(
                stock=Product.stock - item.quantity,
                is_available=Product.stock - item.quantity > 0
            )
            .returning(Product.stock, Product.name, Product.vendor_id)
        )
        updated_row = result.fetchone()
        if not updated_row:
            raise HTTPException(
                status_code=400,
                detail="Insufficient stock for product (concurrent purchase detected). Please refresh and try again."
            )

        new_stock, product_name, vendor_id_for_push = updated_row

        # Low stock push threshold evaluator
        if new_stock <= 5:
            # H-08 FIX: Renamed vendor to stock_alert_vendor to prevent shadowing
            stock_alert_vendor = await session.get(Vendor, vendor_id_for_push)
            if stock_alert_vendor:
                title = "Low Stock Alert! ⚠️"
                body = f"'{product_name}' is running critically low ({new_stock} left). Restock soon!"
                action_url = "/(screens)/Inventory"
                await create_notification(
                    session=session,
                    user_id=stock_alert_vendor.id,
                    user_type="vendor",
                    title=title,
                    message=body,
                    message_type="low_stock",
                    action_url=action_url
                )
                if stock_alert_vendor.push_token:
                    asyncio.create_task(send_push_message(
                        to=stock_alert_vendor.push_token,
                        title=title,
                        body=body,
                        data={"url": action_url}
                    ))

      await session.commit()

    return grouped_items

async def update_orders_payment_status_by_checkout_id(
    session: AsyncSession,
    checkout_request_id: str,
    new_status: str
):
    stmt = select(Order).where(Order.checkout_request_ID == checkout_request_id).options(joinedload(Order.vendor))
    result = await session.execute(stmt)
    orders = result.scalars().all()

    if not orders:
        return {"message": "No orders found with that checkout_request_ID"}

    for order in orders:
        order.payment_status = new_status
        if new_status == "paid":
            try:
                from routes.websocket_routes import manager
                await manager.broadcast_order_update(
                    vendor_id=str(order.vendor_id),
                    customer_id=str(order.customer_id),
                    deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
                    payload={"action": "NEW_ORDER", "order_id": str(order.id), "status": "paid"}
                )
            except Exception as e:
                logger.error(f"WS Broadcast fail: {e}")

            if order.vendor:
                from services.order_snapshot import build_order_snapshot
                from services.dispatch_policy import DispatchPolicy
                
                # Fetch order items including product relationship
                _items_result = await session.execute(
                    select(OrderItem).options(joinedload(OrderItem.product))
                    .where(OrderItem.order_id == order.id)
                )
                order_items = _items_result.scalars().all()
                _total_qty = sum(i.quantity for i in order_items)
                _total_weight = sum(float(i.product.weight_kg or 0) * i.quantity for i in order_items if i.product)

                snapshot_data = build_order_snapshot(order, order_items, order.vendor, role="vendor")

                title = "New Order Received! 📦"
                body = (
                    f"Ksh {order.total_amount} | {_total_qty} items | "
                    f"{order.vehicle_class or 'motorbike'} delivery. "
                    f"Type: {order.delivery_type or 'quick_swap'}."
                )
                action_url = "/(screens)/Orders"
                await create_notification(
                    session=session,
                    user_id=order.vendor.id,
                    user_type="vendor",
                    title=title,
                    message=body,
                    message_type="new_order",
                    action_url=action_url,
                    related_order_id=order.id,
                    data=snapshot_data
                )
                if order.vendor.push_token:
                    asyncio.create_task(send_push_message(
                        to=order.vendor.push_token,
                        title=title,
                        body=body,
                        data={"url": action_url}
                    ))
                    
                # Auto-dispatch (only retail per Policy)
                vendor_type_str = order.vendor.vendor_type.value if hasattr(order.vendor.vendor_type, 'value') else order.vendor.vendor_type
                if DispatchPolicy.should_auto_dispatch(vendor_type_str):
                    asyncio.create_task(
                        dispatch_order_to_riders(
                            order_id=order.id,
                            vendor_id=order.vendor_id,
                            customer_id=order.customer_id,
                            lat=order.lat_from,
                            lng=order.lng_from,
                            delivery_fee=float(order.delivery_fee or 0),
                            vehicle_class=order.vehicle_class,
                            vendor_type=vendor_type_str,
                            total_weight_kg=_total_weight,
                            total_quantity=_total_qty,
                            delivery_type=order.delivery_type or "quick_swap",
                            notification_data=snapshot_data
                        )
                    )

    await session.commit()
    return {
        "message": "Transaction was completed successfully.",
        "code": "0"
      }

async def fetch_orders_by_id(session: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 50) -> list[BaseOrder]:
  query = select(Order).where(Order.customer_id == user_id).options(joinedload(Order.order_item).joinedload(OrderItem.product), joinedload(Order.vendor), joinedload(Order.deliverer)).order_by(Order.created_at.desc()).offset(skip).limit(limit)
  result = await session.execute(query)
  orders = result.unique().scalars().all()
  return orders

async def get_last_completed_order(session: AsyncSession, user_id: UUID) -> BaseOrder | None:
    query = (
        select(Order)
        .where(Order.customer_id == user_id, Order.order_status == "delivered")
        .options(joinedload(Order.order_item).joinedload(OrderItem.product), joinedload(Order.vendor), joinedload(Order.deliverer))
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    result = await session.execute(query)
    order = result.unique().scalar_one_or_none()
    return order

async def get_active_order(session: AsyncSession, user_id: UUID) -> BaseOrder | None:
    """Fetch the customer's current active order for the home screen banner."""
    query = (
        select(Order)
        .where(
            Order.customer_id == user_id,
            Order.order_status.in_(["pending", "unassigned", "accepted", "preparing", "ready", "picked_up", "mismatch_pending", "pending_review"])
        )
        .options(joinedload(Order.order_item).joinedload(OrderItem.product), joinedload(Order.vendor), joinedload(Order.deliverer))
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    result = await session.execute(query)
    order = result.unique().scalar_one_or_none()
    return order

async def fetch_order_tracking_logs(session: AsyncSession, order_id: UUID):
    """Fetch historical tracking logs for an order to draw the polyline."""
    from models.order_tracking_log_model import OrderTrackingLog
    query = (
        select(OrderTrackingLog)
        .where(OrderTrackingLog.order_id == order_id)
        .order_by(OrderTrackingLog.created_at.asc())
    )
    result = await session.execute(query)
    return result.scalars().all()

async def cancel_customer_order(session: AsyncSession, user_id: UUID, order_id: UUID):
    """Customer cancels their own order before preparation"""
    order = await session.get(Order, order_id)
    if not order or order.customer_id != user_id:
        raise HTTPException(status_code=404, detail="Order not found")

    # Only allow cancellation for orders that haven't been processed yet
    valid_cancellations = ["pending", "accepted", "unassigned"]
    if order.order_status not in valid_cancellations:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order.order_status}'. Only pending, accepted, or unassigned orders can be cancelled."
        )

    # H-05 FIX: Add cancellation penalty for accepted orders
    # If the order is "accepted", the vendor is likely preparing it.
    # We enforce a KSH 50 cancellation fee added to their debt balance.
    if order.order_status == "accepted":
        user = await session.get(User, user_id)
        if user:
            penalty = 50.0
            user.debt_balance = float(user.debt_balance or 0) + penalty
            logger.info(f"Cancellation penalty of KSH {penalty} applied to user {user_id}")

    # M-08 FIX: Release rider availability if assigned
    if order.deliverer_id:
        deliverer = await session.get(Deliverer, order.deliverer_id)
        if deliverer:
            deliverer.is_available = True

    order.order_status = "cancelled"

    # BUG-05 FIX: Restore stock on cancellation
    items_q = select(OrderItem).where(OrderItem.order_id == order.id)
    result = await session.execute(items_q)
    items = result.scalars().all()

    for item in items:
        await session.execute(
            update(Product)
            .where(Product.id == item.product_id)
            .values(
                stock=Product.stock + item.quantity,
                is_available=True
            )
        )

    # Restore Wallet Balance and Welcome Offer
    user = await session.get(User, user_id)
    if user:
        if order.wallet_discount and float(order.wallet_discount) > 0:
            user.wallet_balance = float(user.wallet_balance or 0) + float(order.wallet_discount)
            logger.info(f"Restored KSH {order.wallet_discount} to wallet for user {user_id}")
            
        if order.is_welcome_offer or (order.welcome_discount and float(order.welcome_discount) > 0):
            user.has_used_welcome_offer = False
            logger.info(f"Reset welcome offer status for user {user_id} due to cancellation")

    # Flag paid orders for refund
    if order.payment_status == "paid":
        order.payment_status = "refund_pending"
        # Track the platform revenue lost due to this cancellation
        order.commission_lost = order.platform_total

    # Notify Vendor
    vendor = await session.get(Vendor, order.vendor_id)
    if vendor:
        title = "Order Cancelled ❌"
        body = "Customer has cancelled their order."
        action_url = "/(screens)/Orders"
        await create_notification(
            session=session,
            user_id=vendor.id,
            user_type="vendor",
            title=title,
            message=body,
            message_type="order_cancelled",
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
    
    # Notify Rider
    if order.deliverer_id:
        deliverer = await session.get(Deliverer, order.deliverer_id)
        if deliverer:
            title = "Delivery Cancelled ❌"
            body = "Customer has cancelled the order you were assigned."
            action_url = "/(screens)/ActiveDelivery"
            await create_notification(
                session=session,
                user_id=deliverer.id,
                user_type="rider",
                title=title,
                message=body,
                message_type="delivery_cancelled",
                action_url=action_url,
                related_order_id=order.id
            )
            if deliverer.push_token:
                asyncio.create_task(send_push_message(
                    to=deliverer.push_token,
                    title=title,
                    body=body,
                    data={"url": action_url}
                ))

    await session.commit()

    # Broadcast real-time order status update via WebSocket
    try:
        from routes.websocket_routes import manager
        await manager.broadcast_order_update(
            vendor_id=str(order.vendor_id),
            customer_id=str(order.customer_id),
            deliverer_id=str(order.deliverer_id) if order.deliverer_id else "",
            payload={"action": "ORDER_STATUS_UPDATE", "order_id": str(order.id), "status": "cancelled"}
        )
    except Exception as e:
        logger.error(f"WS Broadcast fail in cancel_customer_order: {e}")

    return {"message": "Order cancelled successfully", "order_id": str(order.id)}


# ── Order Assignment Retry Engine ──────────────────────────────────────────
# Re-assigns orders that have status="unassigned" and no rider after 3+ minutes

async def reassign_unassigned_orders(session: AsyncSession):
    """
    Queries all orders with status='unassigned' older than 3 minutes.
    For each, finds the nearest available rider using Haversine and assigns them.
    Called:
      1. When a rider toggles availability to True
      2. As a background task after new order creation
    """
    import datetime

    cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=3)
    stmt = select(Order).where(
        Order.order_status == "unassigned",
        Order.deliverer_id.is_(None),
        Order.created_at <= cutoff
    ).order_by(Order.created_at.asc())

    result = await session.execute(stmt)
    unassigned_orders = result.scalars().all()

    if not unassigned_orders:
        return {"reassigned": 0}

    reassigned_count = 0

    for order in unassigned_orders:
        # Use the vendor/pickup location to find closest rider
        lat_from = order.lat_from or 0.0
        lng_from = order.lng_from or 0.0

        deliverer = await get_closest_deliverer(
            session=session, lat=lat_from, lng=lng_from,
            vendor_id=order.vendor_id,
            vehicle_class=order.vehicle_class or "motorbike",
        )
        if not deliverer:
            continue
            
        # H-02 FIX: Do not force auto-assign. Just broadcast the offer to the closest rider via Trip Radar.
        # Wait for them to actively accept it instead of forcing them offline.
        # Order stays 'unassigned'.
        reassigned_count += 1

        # BUG-08 FIX: Push-notify the newly assigned rider with order details
        title = "New Delivery Assignment! 📦"
        body = (
            f"Ksh {order.delivery_fee or 0:.0f} fee | "
            f"{order.delivery_type or 'quick_swap'} | "
            f"{order.distance_km or 0:.1f}km | "
            f"{order.vehicle_class or 'motorbike'}. Tap to start."
        )
        action_url = "/(screens)/ActiveDelivery"
        await create_notification(
            session=session,
            user_id=deliverer.id,
            user_type="rider",
            title=title,
            message=body,
            message_type="new_delivery",
            action_url=action_url,
            related_order_id=order.id
        )
        if deliverer.push_token:
            asyncio.create_task(send_push_message(
                to=deliverer.push_token,
                title=title,
                body=body,
                data={"url": action_url}
            ))

        # Broadcast assignment via WebSocket
        try:
            from routes.websocket_routes import manager
            await manager.broadcast_order_update(
                vendor_id=str(order.vendor_id),
                customer_id=str(order.customer_id),
                deliverer_id=str(deliverer.id),
                payload={
                    "action": "ORDER_OFFER_BROADCAST",
                    "order_id": str(order.id),
                    "status": "unassigned",
                    "deliverer_id": str(deliverer.id),
                }
            )
        except Exception as e:
            logger.error(f"WS broadcast fail in reassign: {e}")

    await session.commit()
    logger.info(f"Reassigned {reassigned_count} unassigned orders")
    return {"reassigned": reassigned_count}

# ── C-03 FIX: Mismatch Resolution Logic ────────────────────────────────────

async def resolve_address_mismatch(session: AsyncSession, user_id: UUID, order_id: UUID, action: str):
    """
    Handles customer response to a rider flagging an address mismatch.
    action: "approve_charge" | "leave_ground"
    """
    order = await session.get(Order, order_id)
    if not order or order.customer_id != user_id:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.order_status != "mismatch_pending":
        raise HTTPException(status_code=400, detail="Order is not in mismatch state")

    if action == "approve_charge":
        # Customer accepts the KSh 30 staircase charge
        charge = 30.0
        order.staircase_surcharge = float(order.staircase_surcharge or 0) + charge
        order.total_amount = float(order.total_amount or 0) + charge
        
        # Add to customer's debt balance since M-PESA already processed the original total
        user = await session.get(User, user_id)
        if user:
            user.debt_balance = float(user.debt_balance or 0) + charge
        
        # Determine rider payout vs platform based on employment type
        # For gig economy riders, they keep 100% of the surcharge
        # For in-house, it goes to the vendor/platform
        deliverer = await session.get(Deliverer, order.deliverer_id) if order.deliverer_id else None
        if deliverer and deliverer.employment_model == "gig_economy":
            order.rider_net = float(order.rider_net or 0) + charge
        else:
            order.vendor_net = float(order.vendor_net or 0) + charge

    elif action == "leave_ground":
        # No extra charge, rider leaves at ground floor
        pass
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    # Transition back to picked_up so rider can complete delivery
    order.order_status = "picked_up"
    await session.commit()

    # Notify Rider
    if order.deliverer_id:
        title = "Mismatch Resolved ✅"
        body = "Customer approved the staircase charge. Proceed up." if action == "approve_charge" else "Customer requested drop-off at ground floor."
        await create_notification(
            session=session,
            user_id=order.deliverer_id,
            user_type="rider",
            title=title,
            message=body,
            message_type="mismatch_resolved",
            action_url="/(screens)/ActiveDelivery"
        )
        
        # Broadcast to rider app
        try:
            from routes.websocket_routes import manager
            await manager.broadcast_order_update(
                vendor_id=str(order.vendor_id),
                customer_id=str(order.customer_id),
                deliverer_id=str(order.deliverer_id),
                payload={
                    "action": "MISMATCH_RESOLVED",
                    "order_id": str(order.id),
                    "status": "picked_up",
                    "resolution": action
                }
            )
        except Exception as e:
            logger.error(f"WS Broadcast fail in resolve_mismatch: {e}")

    return {"message": "Mismatch resolved successfully", "order": {"id": str(order.id), "status": order.order_status, "total_amount": order.total_amount}}