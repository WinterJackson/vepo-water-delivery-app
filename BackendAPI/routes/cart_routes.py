from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, Depends, Request, HTTPException, Query
from dependencies.dependencies import get_db
from dependencies.auth_dependencies import get_current_customer
from core.redis_client import redis_limiter as limiter
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from services.user_service import get_user
from services.cart_services import add_to_cart_service, fetch_cart, fetch_detailed_cart, change_cart_item_quantity_service, delete_cart_item_service, delete_cart_service
from schemas.common_schemas import RequestBodyIdAndQuantity, RequestBodyId
from schemas.cart_schemas import CartDetailed
from services.payment_service import initiate_stk_push, check_payment
from services.order_service import create_order, fetch_orders_by_id, update_orders_payment_status_by_checkout_id, cancel_customer_order
from uuid import UUID

# payment imports
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.payment_service import is_safaricom_ip

logger = logging.getLogger(__name__)


# order imports
from schemas.order_schema import BaseOrder


router = APIRouter()

# CART ROUTES[
                  # NB / BEWARE OF THE TOTALS WHENEVER YOU ARE MANIPULATING THE CART 
  # >ADD TO CART 
      # POSSIBILITIES [ CART DOES NOT EXIST, CART EXISTS, ITEM DOES NOT EXIST IN THE CART, ITEM EXISTS IN THE CART]
        # CART DOES NOT EXIST [ >--> CREATE THE CART AND ADD THE ITEM IN THE CART ]
        # CART EXISTS [ >--> CHECK IF ITEM EXISTS IN THE CART OR NOT ]
        # ITEM DOESN'T EXIST IN CART [ >--> ADD THE ITEM TO THE EXISTING CART AND UPDATE THE TOTAL ACCORDINGLY ]
        # ITEM EXISTS [ >--> JUST INCREASE ITS QUANTITY AND UPDATE THE TOTAL ACCORDINGLY ]
        
  # >FETCH CART AND CART ITEMS FO A SPECIFIC USER 
      # POSSIBILITIES [ CART EXISTS , CART DOES NOT EXIST ]
        # CART DOESN'T EXIST [ JUST RETURN NOTHING ]
        # CART EXISTS [ RETURN THE CART  ]
  # >ADD ITEMS TO CART [ NEW ITEM AND INCREASING QUANTITY ]
  # >CHANGE QUANTITY OF ANT ITEM IN THE CART [ INCREASE & DECREASE ]
  # >DELETE CART 
# ]

class AddToCartRequest(BaseModel):
  id: str | UUID
  quantity: int
  force_replace: bool = False

@router.post("/add_to_cart")
@limiter.limit("15/minute")
async def add_to_cart(request: Request, request_body: AddToCartRequest, db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
  clerkId = user["sub"]
  db_user = await get_user(session=db, clerk_id=clerkId)
  if not db_user:
    raise HTTPException(status_code=403, detail="Customer profile not found.")
  await add_to_cart_service(
    user_id=db_user.id,
    session=db,
    product_id=request_body.id,
    quantity=request_body.quantity,
    force_replace=request_body.force_replace
  )
  return {
    "message": "Item added to cart"
  }

class Id(BaseModel):
  id: str | UUID
@router.get("/get_cart")
# async def get_cart( request: Id, db: AsyncSession = Depends(get_db)):
async def get_cart( db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
  clerkId = user["sub"]
  user = await get_user(session=db, clerk_id=clerkId)
  cart = await fetch_cart(user_id=user.id, session=db)
  return cart

@router.get("/get_detailed_cart", response_model=CartDetailed | None)
async def get_detailed_cart(db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
  clerk_id = user["sub"]
  db_user = await get_user(session=db, clerk_id=clerk_id)
  cart = await fetch_detailed_cart(user_id=db_user.id, session=db)
  return cart

@router.post("/change_cart_item_quantity")
async def change_cart_item_quantity(request_body: RequestBodyIdAndQuantity, db: AsyncSession= Depends(get_db), user = Depends(get_current_customer)):
  clerkId = user["sub"]
  user = await get_user(session=db, clerk_id=clerkId)
  await change_cart_item_quantity_service(user_id=user.id, session=db, quantity=request_body.quantity, id=request_body.id)
  return {
    "message": "Cart Quantity Updated"
  }

@router.post("/delete_cart_item")
async def delete_cart_item(request_body: RequestBodyId, db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
  clerkId = user["sub"]
  user_obj = await get_user(session=db, clerk_id=clerkId)
  await delete_cart_item_service(cart_item_id=request_body.id, user_id=user_obj.id, session=db)
  return {
    "message": "item deleted successfully"
  }

# payment test
class OrderRequest(BaseModel):
    phone: str  # Format: 2547XXXXXXXX
    # NOTE: `amount` intentionally removed (F-018). Server calculates total from
    # cart items + delivery fee to prevent client-side price manipulation.
    id: UUID
    lat: float
    lng: float
    delivery_type: str = "quick_swap"
    payment_method: str = "mpesa"

@router.post("/mpesa_payment")
@limiter.limit("5/minute")
async def payment_request(request: Request, order: OrderRequest, db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
    clerk_id = user["sub"]
    db_user = await get_user(session=db, clerk_id=clerk_id)
    if not db_user:
        raise HTTPException(status_code=403, detail="Customer profile not found.")
    authenticated_user_id = db_user.id

    # ── F-018 FIX: Calculate amount server-side from cart total ──────────
    from services.cart_services import fetch_detailed_cart
    from services.order_service import calculate_delivery_fee
    from services.dispatch_policy import DispatchPolicy
    cart = await fetch_detailed_cart(user_id=authenticated_user_id, session=db)
    if cart and getattr(cart, 'is_locked', False):
        raise HTTPException(
            status_code=409, 
            detail="A checkout is already in progress for this cart. Please wait for the M-PESA prompt or check your orders."
        )

    cart_total = float(cart.total_amount) - float(cart.welcome_discount_amount)
    
    user_model = None
    
    # Get vendor coordinates for delivery fee calculation 
    if cart.cart_item:
        vendor_id = cart.cart_item[0].vendor_id
        from models.vendor_model import Vendor
        first_vendor = await db.get(Vendor, vendor_id)
        
        # --- Pre-flight Validation 1: Dispatch Policy Constraints ---
        total_quantity = sum(item.quantity for item in cart.cart_item)
        total_weight_kg = sum((item.product.weight_kg if item.product else 0.0) * item.quantity for item in cart.cart_item)
        vendor_type_str = first_vendor.vendor_type.value if hasattr(first_vendor.vendor_type, 'value') else first_vendor.vendor_type
        
        delivery = calculate_delivery_fee(
            lat_from=first_vendor.lat if first_vendor else 0,
            lng_from=first_vendor.lng if first_vendor else 0,
            lat_to=order.lat, lng_to=order.lng,
            vendor_type=vendor_type_str,
            vehicle_class=DispatchPolicy.get_vehicle_class(total_quantity) if total_quantity > 0 else "motorbike",
            delivery_type=order.delivery_type
        )

        try:
            DispatchPolicy.validate_cart_preflight(
                vendor_type=vendor_type_str,
                distance_km=delivery["distance_km"],
                total_quantity=total_quantity,
                total_weight_kg=total_weight_kg
            )
        except Exception as e:
            raise e
            
        # --- Pre-flight Validation 2: Stock Availability ---
        for item in cart.cart_item:
            product = item.product
            if not product or product.stock < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product '{product.name if product else 'unknown'}'. Available: {product.stock if product else 0}"
                )

        # Include service fee in server amount
        vendor_type_str_for_fee = first_vendor.vendor_type.value if hasattr(first_vendor.vendor_type, 'value') else first_vendor.vendor_type
        service_fee = 50.0 if vendor_type_str_for_fee == "wholesale_b2b" else 10.0
        
        # --- Surcharges (Must match order_service.py exactly) ---
        payload_surcharge = 0.0
        staircase_surcharge = 0.0
        if total_quantity > 2:
            payload_surcharge = float((total_quantity - 2) * 10.0)

        # We need the user object to check floor level and welcome offer status
        from models.user_model import User
        user_model = await db.get(User, authenticated_user_id)
        
        # --- First-Time User Bottle Injection ---
        bottle_fee_total = 0.0
        welcome_discount = 0.0
        if user_model and not getattr(user_model, 'has_used_welcome_offer', True) and order.delivery_type == "quick_swap":
            highest_bottle_price = 0.0
            for item in cart.cart_item:
                product = item.product
                if product:
                    capacity = getattr(product, 'capacity', 0)
                    if capacity == 20:
                        bottle_fee_total += 300.0 * item.quantity
                        highest_bottle_price = max(highest_bottle_price, 300.0)
                    elif capacity == 10:
                        bottle_fee_total += 150.0 * item.quantity
                        highest_bottle_price = max(highest_bottle_price, 150.0)
            
            if highest_bottle_price > 0:
                welcome_discount = highest_bottle_price * 0.30
                
        wallet_discount = 0.0
        if user_model:
            floor_level = getattr(user_model, 'floor_level', 0)
            has_elevator = getattr(user_model, 'has_elevator', False)
            if floor_level > 2 and not has_elevator:
                staircase_surcharge = float((floor_level - 2) * 10.0)
            
            # --- Loyalty Wallet Cashback Application ---
            if user_model.wallet_balance and user_model.wallet_balance > 0:
                pre_discount = cart_total + bottle_fee_total - welcome_discount + delivery["fee"] + service_fee + payload_surcharge + staircase_surcharge
                # Cap discount so STK Push never attempts <= 0
                max_discount = max(0.0, float(pre_discount) - 1.0)
                wallet_discount = min(float(user_model.wallet_balance), max_discount)

        server_amount = int(cart_total + bottle_fee_total - welcome_discount + delivery["fee"] + service_fee + payload_surcharge + staircase_surcharge - wallet_discount)

    else:
        server_amount = int(cart_total)

    # --- Pre-flight Validation 4: Debt Intercept ---
    if user_model and getattr(user_model, 'debt_balance', 0) and float(user_model.debt_balance) > 0:
        raise HTTPException(
            status_code=402,
            detail=f"You have an outstanding bottle deposit debt of KSH {float(user_model.debt_balance):.0f}. Please clear it before placing a new order."
        )

    if server_amount <= 0:
        raise HTTPException(status_code=400, detail="Cart total must be greater than zero")

    # Lock the cart to prevent race conditions during the STK Push window
    cart.is_locked = True
    await db.commit()

    try:
        if order.payment_method == "cash":
            # For Cash on Delivery, bypass STK Push and create order directly
            logger.info(f"Cash order requested, server_amount: {server_amount}")
            orders = await create_order(
                session=db, id=order.id, type="cart", 
                CheckoutRequestID=None, user_id=authenticated_user_id, 
                phone=order.phone, lat=order.lat, lng=order.lng, 
                delivery_type=order.delivery_type, payment_method="cash"
            )
            if not orders:
                raise HTTPException(status_code=400, detail="Orders not created. Something went wrong.")
            
            # Immediately delete cart for cash orders since payment is deferred
            try:
                from services.cart_services import delete_cart_service
                await delete_cart_service(cart_id=str(cart.id), db=db)
            except Exception as e:
                logger.error(f"Failed to clear cart after cash order creation: {e}")

            return {
              "message": "order created",
              "payment_method": "cash",
              "CheckoutRequestID": None
            }
        else:
            # M-PESA STK Push Flow
            response = await initiate_stk_push(phone=order.phone, amount=server_amount)
            CheckoutRequestID = response.get("CheckoutRequestID")
            logger.info(f"STK push initiated, CheckoutRequestID: {CheckoutRequestID}, server_amount: {server_amount}")
            orders = await create_order(
                session=db, id=order.id, type="cart", 
                CheckoutRequestID=CheckoutRequestID, user_id=authenticated_user_id, 
                phone=order.phone, lat=order.lat, lng=order.lng, 
                delivery_type=order.delivery_type, payment_method="mpesa"
            ) 
            if not orders:
                raise HTTPException(status_code=400, detail="Orders not created. Something went wrong.")
            # F-018 & RACE CONDITION FIX: Delay cart deletion until /confirm_payment or /mpesa/callback succeeds.
            return {
              "message": "order created",
              "payment_method": "mpesa",
              "CheckoutRequestID": CheckoutRequestID
            }
    except Exception as e:
        # Unlock the cart if STK push fails immediately
        cart.is_locked = False
        await db.commit()
        raise e

class RequestCheckoutRequestID(BaseModel):
  CheckoutRequestID: str  
@router.post("/confirm_payment")
@limiter.limit("20/minute")
async def payment_confirmation(request: Request, body: RequestCheckoutRequestID, db: AsyncSession = Depends(get_db), user = Depends(get_current_customer)):
  CheckoutRequestID = body.CheckoutRequestID
  response = await check_payment(checkout_request_id=CheckoutRequestID, session=db)
  
  # BUG-04 FIX: Purge cart after successful manual payment confirmation
  if response.get("code") == "0":
      try:
          clerk_id = user["sub"]
          user_obj = await get_user(session=db, clerk_id=clerk_id)
          cart = await fetch_cart(user_id=user_obj.id, session=db)
          if cart:
              await delete_cart_service(cart_id=str(cart.id), db=db)
      except Exception as e:
          logger.error(f"Failed to clear cart after confirm_payment: {e}")

  return response

@router.get("/get_orders",response_model=list[BaseOrder])
async def get_orders_by_id(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession= Depends(get_db),
    user = Depends(get_current_customer)
):
  clerkId = user["sub"]
  user = await get_user(session=db, clerk_id=clerkId)
  orders = await fetch_orders_by_id(session=db, user_id=user.id, skip=skip, limit=limit)
  return orders

@router.get("/orders/last-completed", response_model=BaseOrder | None)
async def fetch_last_completed_order(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_customer)
):
    from services.order_service import get_last_completed_order
    clerkId = user["sub"]
    user_obj = await get_user(session=db, clerk_id=clerkId)
    order = await get_last_completed_order(session=db, user_id=user_obj.id)
    return order

@router.get("/orders/active", response_model=BaseOrder | None)
async def fetch_active_order(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_customer)
):
    from services.order_service import get_active_order
    clerkId = user["sub"]
    user_obj = await get_user(session=db, clerk_id=clerkId)
    order = await get_active_order(session=db, user_id=user_obj.id)
    return order

import os

MPESA_CALLBACK_SECRET = os.getenv("MPESA_CALLBACK_SECRET")

@router.post("/mpesa/callback")
async def mpesa_callback(request: Request, db: AsyncSession = Depends(get_db), secret: str | None = Query(default=None)):
    if MPESA_CALLBACK_SECRET and secret != MPESA_CALLBACK_SECRET:
        logger.warning("M-PESA callback rejected: invalid or missing shared secret")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    forwarded_for = request.headers.get("x-forwarded-for")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
    if not is_safaricom_ip(client_ip):
        logger.warning(f"M-PESA callback rejected from non-Safaricom IP: {client_ip}")
        return JSONResponse(status_code=403, content={"message": "Forbidden"})

    try:
        data = await request.json()
        callback = data["Body"]["stkCallback"]
        result_code = callback["ResultCode"]
        result_desc = callback["ResultDesc"]
        checkout_request_id = callback["CheckoutRequestID"]

        if result_code == 0:
            metadata = callback["CallbackMetadata"]["Item"]
            callback_amount = next(item["Value"] for item in metadata if item["Name"] == "Amount")
            callback_phone = str(next(item["Value"] for item in metadata if item["Name"] == "PhoneNumber"))
            receipt = next(item["Value"] for item in metadata if item["Name"] == "MpesaReceiptNumber")

            # --- Cross-validate callback against original order record ---
            from sqlalchemy import select as sa_select
            from models.order_model import Order
            stmt = sa_select(Order).where(Order.checkout_request_ID == checkout_request_id)
            result = await db.execute(stmt)
            order = result.scalars().first()

            if not order:
                logger.error(f"M-PESA callback: No order found for CheckoutRequestID {checkout_request_id}")
                return JSONResponse(status_code=400, content={"message": "Order not found"})

            # Validate phone matches (compare last 9 digits to handle country code variations)
            order_phone_suffix = order.phone[-9:] if order.phone else ""
            callback_phone_suffix = callback_phone[-9:] if callback_phone else ""
            if order_phone_suffix != callback_phone_suffix:
                logger.error(f"M-PESA callback phone mismatch: order={order.phone}, callback={callback_phone}")
                return JSONResponse(status_code=400, content={"message": "Phone mismatch"})

            # Validate amount matches (allow ±1 KSH tolerance for rounding)
            if abs(float(order.total_amount) - float(callback_amount)) > 1.0:
                logger.error(f"M-PESA callback amount mismatch: order={order.total_amount}, callback={callback_amount}")
                return JSONResponse(status_code=400, content={"message": "Amount mismatch"})

            from utils.redaction import redact_phone
            logger.info(f"M-PESA Payment Verified: receipt={receipt}, amount={callback_amount}, phone={redact_phone(str(callback_phone))}")

            # --- Create Payment audit record for successful transaction ---
            from models.payment_model import Payment
            payment = Payment(
                order_id=order.id,
                checkout_request_id=checkout_request_id,
                mpesa_receipt=receipt,
                phone=callback_phone,
                amount=callback_amount,
                status="paid",
            )
            db.add(payment)

            await update_orders_payment_status_by_checkout_id(
                session=db, checkout_request_id=checkout_request_id, new_status="paid"
            )
            
            # --- Send Order Confirmation Email ---
            try:
                from models.user_model import User
                from services.email_service import send_order_confirmation
                # EDGE-02 FIX: customer_id is a UUID (User.id), not a Clerk ID
                stmt_user = sa_select(User).where(User.id == order.customer_id)
                user_res = await db.execute(stmt_user)
                customer = user_res.scalars().first()
                if customer and customer.email:
                    order_details = {
                        "id": str(order.id)[:8].upper(),
                        "total": order.total_amount,
                        "date": order.created_at.strftime("%b %d, %Y") if order.created_at else "Today"
                    }
                    send_order_confirmation(
                        to=customer.email, 
                        name=customer.full_name or "Valued Customer", 
                        order_details=order_details
                    )
            except Exception as email_err:
                logger.error(f"Failed to send order confirmation email: {email_err}")

            # Safely clear the original cart payload since the order is finalized
            try:
                from services.cart_services import delete_cart_service
                # Use the order details. In create_order, the order.user_id matches the Cart user
                # We can fetch the cart by user ID and delete it.
                from services.cart_services import fetch_cart
                cart_record = await fetch_cart(user_id=order.customer_id, session=db)
                if cart_record:
                    await delete_cart_service(cart_id=str(cart_record.id), db=db)
            except Exception as cart_e:
                logger.error(f"Error purging active cart after callback success: {cart_e}")
        else:
            logger.warning(f"M-PESA Payment Failed: {result_desc} (Code: {result_code})")
            # --- Create Payment audit record for failed transaction ---
            try:
                from models.payment_model import Payment
                from sqlalchemy import select as sa_select
                from models.order_model import Order
                stmt = sa_select(Order).where(Order.checkout_request_ID == checkout_request_id)
                result = await db.execute(stmt)
                order = result.scalars().first()
                payment = Payment(
                    order_id=order.id if order else None,
                    checkout_request_id=checkout_request_id,
                    phone=order.phone if order else "unknown",
                    amount=float(order.total_amount) if order else 0,
                    status="failed",
                    failure_reason=result_desc,
                )
                db.add(payment)
                
                # EDGE-01 FIX: Unlock the cart so the user can try again
                if order:
                    from services.cart_services import fetch_cart
                    cart_record = await fetch_cart(user_id=order.customer_id, session=db)
                    if cart_record:
                        cart_record.is_locked = False
                
                await db.commit()
            except Exception as pay_e:
                logger.error(f"Error creating failed payment record: {pay_e}")

    except Exception as e:
        logger.error("Error processing M-PESA callback", exc_info=True)
        try:
            import sentry_sdk
            from utils.redaction import redact_payload
            raw_body = await request.body()
            payload_str = raw_body.decode("utf-8")
            redacted_payload = redact_payload(payload_str)
            sentry_sdk.set_context("webhook_payload", {"raw": redacted_payload})
            sentry_sdk.capture_exception(e)
            
            # DLQ: Store in database
            from dependencies.dependencies import get_db_session
            from models.failed_webhook_model import FailedWebhook
            async with get_db_session() as session:
                dlq_entry = FailedWebhook(
                    source="mpesa",
                    payload=redacted_payload,
                    error_message=str(e)
                )
                session.add(dlq_entry)
                await session.commit()
                logger.info(f"Saved failed webhook to DLQ: {dlq_entry.id}")
        except Exception as dlq_err:
            logger.error(f"Failed to save webhook to DLQ: {dlq_err}", exc_info=True)
        return JSONResponse(status_code=400, content={"message": "Invalid payload"})

    return {"message": "Callback received"}


@router.put("/orders/{order_id}/cancel")
async def customer_cancel_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_customer),
):
    """Customer cancels their own order"""
    clerk_id = user["sub"]
    user_obj = await get_user(session=db, clerk_id=clerk_id)
    result = await cancel_customer_order(session=db, user_id=user_obj.id, order_id=order_id)
    return result

@router.get("/orders/{order_id}/tracking-logs")
async def get_order_tracking_logs(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_customer),
):
    """Fetch tracking logs for an order (historical route)"""
    from services.order_service import fetch_order_tracking_logs
    logs = await fetch_order_tracking_logs(session=db, order_id=order_id)
    return logs


class ResolveMismatchPayload(BaseModel):
    action: str  # "approve_charge" | "leave_ground"

@router.patch("/orders/{order_id}/resolve-mismatch")
async def customer_resolve_mismatch(
    order_id: UUID,
    payload: ResolveMismatchPayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_customer),
):
    """Customer responds to an Address Mismatch flag"""
    clerk_id = user["sub"]
    user_obj = await get_user(session=db, clerk_id=clerk_id)
    from services.order_service import resolve_address_mismatch
    result = await resolve_address_mismatch(session=db, user_id=user_obj.id, order_id=order_id, action=payload.action)
    return result
