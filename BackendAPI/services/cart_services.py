from fastapi import HTTPException
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload, selectinload, with_loader_criteria
from models.cart_model import Cart, CartItem
from models.product_model import Product
from models.user_model import User
from models.vendor_model import Vendor
from schemas.cart_schemas import CartDetailed
from sqlalchemy.ext.asyncio import AsyncSession
from services.product_service import get_product_for_cart
from decimal import Decimal
# >ADD TO CART 
      # POSSIBILITIES [ CART DOES NOT EXIST, CART EXISTS, ITEM DOES NOT EXIST IN THE CART, ITEM EXISTS IN THE CART]
        # CART DOES NOT EXIST [ >--> CREATE THE CART AND ADD THE ITEM IN THE CART ]
        # CART EXISTS [ >--> CHECK IF ITEM EXISTS IN THE CART OR NOT ]
        # ITEM DOESN'T EXIST IN CART [ >--> ADD THE ITEM TO THE EXISTING CART AND UPDATE THE TOTAL ACCORDINGLY ]
        # ITEM EXISTS [ >--> JUST INCREASE ITS QUANTITY AND UPDATE THE TOTAL ACCORDINGLY ]

async def fetch_cart(user_id: UUID, session: AsyncSession) -> Cart:
  query = select(Cart).where(Cart.customer_id == user_id).options(selectinload(Cart.cart_item))
  result = await session.execute(query)
  cart =  result.unique().scalar_one_or_none()
  
  if cart:
      # Auto-heal denormalized counters to ensure badge always matches actual items
      actual_items = len(cart.cart_item)
      actual_total = sum(item.Subtotal for item in cart.cart_item)
      
      if cart.items_count != actual_items or float(cart.total_amount) != float(actual_total):
          cart.items_count = actual_items
          cart.total_amount = actual_total
          await session.commit()
          
  return cart

async def fetch_detailed_cart(user_id: UUID, session: AsyncSession) -> CartDetailed:
  query = select(Cart).where(Cart.customer_id == user_id).options(
    joinedload(Cart.cart_item).joinedload(CartItem.product).joinedload(Product.vendor),
    with_loader_criteria(CartItem, lambda cls: True, include_aliases=True)
  )
  result = await session.execute(query)
  cart =  result.unique().scalar_one_or_none()
  if not cart:
    raise HTTPException(status_code=404)
  cart.cart_item.sort(key=lambda item: item.id)  # or item.product.name.lower()
  
  # Inject dynamic empty bottle deposit requirements
  welcome_discount_amount = 0.0
  service_fee = 0.0
  
  if cart.cart_item:
      vendor_id = cart.cart_item[0].vendor_id
      user = await session.get(User, user_id)
      vendor = await session.get(Vendor, vendor_id)
      
      if user and vendor:
          vendor_type_str = vendor.vendor_type.value if hasattr(vendor.vendor_type, 'value') else vendor.vendor_type
          service_fee = 50.0 if vendor_type_str == "wholesale_b2b" else 12.0
          
          # Welcome discount and bottle fee injection is now handled dynamically
          # based on delivery_type during checkout and in the Cart UI.
          welcome_discount_amount = 0.0
          
  cart.welcome_discount_amount = welcome_discount_amount
  cart.service_fee = service_fee
  cart.delivery_fee_quick_swap = 0.0
  cart.delivery_fee_keep_my_bottle = 0.0
  
  return cart

async def add_to_cart_service( user_id: UUID, session: AsyncSession, product_id : UUID, quantity : int, force_replace: bool = False):
  # prepare details for the cart item [customer id, vendor id, product id, quantity, product Price, subtotal]
  product = await get_product_for_cart(session=session,id=product_id)
  # --- Stock Validation ---
  if product.stock < quantity:
    raise HTTPException(status_code=400, detail=f"Insufficient stock for '{product.name}'. Available: {product.stock}")

  actual_price = Decimal(product.price) - Decimal(product.discount or 0)
  
  # check if the cart exists 
  query = select(Cart).where(Cart.customer_id == user_id).options(selectinload(Cart.cart_item))
  result = await session.execute(query)
  existing_cart =  result.unique().scalar_one_or_none()
  
  if existing_cart and getattr(existing_cart, 'is_locked', False):
      raise HTTPException(status_code=409, detail="Cart is locked during checkout. Please wait for payment to complete.")
      
  if not existing_cart:
    # create new cart 
    new_cart = Cart(
      customer_id = user_id
    )
    session.add(new_cart)
    await session.flush()
    # add the cart item 
    cart_item = CartItem(
      cart_id = new_cart.id,
      vendor_id = product.vendor_id,
      product_id = product.id,
      quantity = quantity,
      price = actual_price,
      Subtotal = actual_price * quantity
    )
    session.add(cart_item)
    new_cart.items_count = 1
    new_cart.total_amount = actual_price * quantity
    await session.commit()
  else: 
    # --- Single-Vendor Enforcement ---
    # Check if existing cart items belong to a different vendor
    if existing_cart.cart_item:
        existing_vendor_id = existing_cart.cart_item[0].vendor_id
        if existing_vendor_id != product.vendor_id:
            if not force_replace:
                # Load vendor name for the confirmation dialog
                existing_vendor = await session.get(Vendor, existing_vendor_id)
                existing_vendor_name = existing_vendor.business_name if existing_vendor else "another vendor"
                raise HTTPException(
                    status_code=409,
                    detail={
                        "type": "vendor_conflict",
                        "message": f"Your cart contains items from {existing_vendor_name}. Adding this item will replace your current cart.",
                        "existing_vendor": existing_vendor_name,
                        "existing_vendor_id": str(existing_vendor_id),
                    }
                )
            else:
                # User confirmed replacement — clear the cart and start fresh
                await session.execute(delete(CartItem).where(CartItem.cart_id == existing_cart.id))
                existing_cart.items_count = 0
                existing_cart.total_amount = Decimal(0)
                await session.flush()
                # Fall through to add as new item below
    
    # check if item already exists in the cart 
    existing_item = next((item for item in existing_cart.cart_item if item.product_id == product_id), None)
    
    # --- Retail Capacity Validation ---
    vendor = await session.get(Vendor, product.vendor_id)
    if vendor:
        vendor_type_str = vendor.vendor_type.value if hasattr(vendor.vendor_type, 'value') else vendor.vendor_type
        if vendor_type_str == "retail_refill":
            current_cart_qty = sum(item.quantity for item in existing_cart.cart_item) if not force_replace else 0
            if current_cart_qty + quantity > 4:
                raise HTTPException(status_code=400, detail="Motorbikes can carry a maximum of 4 (20L) bottles per trip. Please reduce the quantity.")

    if existing_item and not force_replace:
    # if it exists update the [quantity of the item , the subtotal , and the total for the cart  ]
      existing_item.quantity += quantity
      existing_item.Subtotal += Decimal(existing_item.price) * quantity
      existing_cart.total_amount += (Decimal(existing_item.price) * quantity)
      await session.commit()
    else:
    # if not add the cart item then update the [total of the cart, and the items count ]
      new_cart_item = CartItem(
        cart_id = existing_cart.id,
        vendor_id = product.vendor_id,
        product_id = product.id,
        quantity = quantity,
        price = actual_price,
        Subtotal = actual_price * quantity
      )
      session.add(new_cart_item)
      existing_cart.total_amount += (actual_price * quantity)
      existing_cart.items_count += 1
      await session.commit()

async def change_cart_item_quantity_service(user_id: UUID, session: AsyncSession, quantity: int, id: UUID):
  query = select(Cart).where(Cart.customer_id == user_id).options(selectinload(Cart.cart_item))
  result = await session.execute(query)
  cart =  result.unique().scalar_one_or_none()
  if not cart: 
    raise HTTPException(status_code=404, detail="Cart Not Found")
    
  if getattr(cart, 'is_locked', False):
      raise HTTPException(status_code=409, detail="Cart is locked during checkout. Please wait for payment to complete.")
      
  cart_item = next((item for item in cart.cart_item if str(item.id) == str(id)), None)
  if not cart_item:
    raise HTTPException(status_code=404, detail="Cart item not found")

  # --- Retail Capacity Validation ---
  vendor = await session.get(Vendor, cart_item.vendor_id)
  if vendor:
      vendor_type_str = vendor.vendor_type.value if hasattr(vendor.vendor_type, 'value') else vendor.vendor_type
      if vendor_type_str == "retail_refill":
          new_total_qty = sum(item.quantity for item in cart.cart_item if str(item.id) != str(id)) + quantity
          if new_total_qty > 4:
              raise HTTPException(status_code=400, detail="Motorbikes can carry a maximum of 4 (20L) bottles per trip.")

  cart.total_amount -= cart_item.Subtotal
  cart_item.quantity = quantity
  cart_item.Subtotal = quantity * cart_item.price
  cart.total_amount += quantity * cart_item.price
  await session.commit()
  return

async def delete_cart_item_service(cart_item_id: UUID, user_id: UUID, session: AsyncSession):
    result = await session.execute(
        select(CartItem)
        .where(CartItem.id == cart_item_id)
        .options(selectinload(CartItem.cart))  # 👈 Load cart eagerly
    )
    cart_item = result.scalar_one_or_none()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if cart_item.cart.customer_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this cart item")

    if getattr(cart_item.cart, 'is_locked', False):
        raise HTTPException(status_code=409, detail="Cart is locked during checkout. Please wait for payment to complete.")

    # Update cart totals
    if cart_item.cart:
        cart_item.cart.items_count -= 1
        cart_item.cart.total_amount -= cart_item.Subtotal

    await session.delete(cart_item)
    await session.commit()

async def delete_cart_service(cart_id: str, db: AsyncSession):
    # Get the cart
    result = await db.execute(select(Cart).where(Cart.id == cart_id))
    cart = result.scalar_one_or_none()

    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    # Delete all related cart items first
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart_id))

    # Then delete the cart
    await db.delete(cart)
    await db.commit()

    return {"message": "Cart and its items deleted successfully"}