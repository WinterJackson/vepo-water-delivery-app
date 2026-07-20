import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.session import AsyncSessionLocal
from models.user_model import User
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from models.product_model import Product
from models.order_model import Order, OrderItem

async def seed_orders():
    async with AsyncSessionLocal() as session:
        # Get one user, or create mock customer
        result = await session.execute(select(User).limit(1))
        user = result.scalars().first()
        if not user:
            user = User(
                email="mock_user@example.com",
                full_name="Mock Customer",
                password="hashed_mock",
                phone_number="1234567890",
                lat=-1.29,
                lng=36.82,
                created_at=datetime.now(timezone.utc)
            )
            session.add(user)
            await session.flush()

        # Get vendors
        result = await session.execute(select(Vendor).limit(3))
        vendors = result.scalars().all()
        if not vendors:
            print("No vendors found!")
            return

        # Get products
        result = await session.execute(select(Product).limit(10))
        products = result.scalars().all()
        
        # Get deliverers
        result = await session.execute(select(Deliverer).limit(2))
        deliverers = result.scalars().all()

        statuses = [
            ("delivered", "paid", "mpesa"),
            ("delivered", "paid", "cash"),
            ("picked_up", "paid", "mpesa"),
            ("cancelled", "failed", "cash"),
            ("picked_up", "paid", "card"),
            ("delivered", "paid", "card"),
        ]

        print(f"Seeding {len(statuses)} realistic orders...")

        for status, payment_status, payment_method in statuses:
            vendor = random.choice(vendors)
            deliverer = random.choice(deliverers) if deliverers else None
            
            order_id = uuid.uuid4()
            
            # Generate items first to calculate the correct total
            order_items = []
            total_items_subtotal = 0.0
            
            for _ in range(random.randint(1, 3)):
                prod = random.choice(products)
                qty = random.randint(1, 5)
                subtotal = prod.price * qty
                total_items_subtotal += subtotal
                
                order_item = OrderItem(
                    order_id=order_id,
                    product_id=prod.id,
                    quantity=qty,
                    price=prod.price,
                    Subtotal=subtotal
                )
                order_items.append(order_item)
                
            delivery_fee = 150.0
            total_amount = total_items_subtotal + delivery_fee
            
            order = Order(
                id=order_id,
                customer_id=user.id,
                vendor_id=vendor.id,
                deliverer_id=deliverer.id if deliverer else None,
                delivery_address="123 Nairobi St, Kilimani",
                lat_from=vendor.lat,
                lng_from=vendor.lng,
                lat=user.lat,
                lng=user.lng,
                total_amount=total_amount,
                order_status=status,
                payment_status=payment_status,
                payment_method=payment_method,
                delivery_fee=delivery_fee,
                delivery_time=random.randint(15, 60),
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
            )
            session.add(order)
            await session.flush()

            for item in order_items:
                session.add(item)
        
        await session.commit()
        print("✅ Orders seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_orders())
