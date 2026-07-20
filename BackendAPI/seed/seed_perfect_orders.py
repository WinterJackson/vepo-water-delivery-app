import asyncio
import random
import uuid
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.session import AsyncSessionLocal
from models.user_model import User
from models.vendor_model import Vendor
from models.deliverer_model import Deliverer
from models.product_model import Product
from models.order_model import Order, OrderItem
from services.order_service import calculate_delivery_fee, calculate_revenue_splits

def generate_point_at_distance(lat, lng, dist_km):
    R = 6371.0 # Earth radius
    brng = math.radians(random.uniform(0, 360))
    lat1 = math.radians(lat)
    lon1 = math.radians(lng)
    
    lat2 = math.asin(math.sin(lat1)*math.cos(dist_km/R) + math.cos(lat1)*math.sin(dist_km/R)*math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng)*math.sin(dist_km/R)*math.cos(lat1), math.cos(dist_km/R)-math.sin(lat1)*math.sin(lat2))
    
    return math.degrees(lat2), math.degrees(lon2)

async def seed_perfect_orders():
    async with AsyncSessionLocal() as session:
        # Get users
        result = await session.execute(select(User).limit(5))
        users = result.scalars().all()
        if not users:
            # Create a mock customer in Ngong Town
            u = User(
                email="ngong_customer@example.com",
                full_name="Ngong Customer",
                clerk_id=f"user_{uuid.uuid4().hex[:10]}",
                phone_number="1234567890",
                lat=-1.3615,
                lng=36.6570,
                created_at=datetime.now(timezone.utc)
            )
            session.add(u)
            await session.flush()
            users = [u]

        # Get vendors
        result = await session.execute(select(Vendor))
        vendors = result.scalars().all()
        retail_vendors = [v for v in vendors if v.vendor_type == "retail_refill"]
        wholesale_vendors = [v for v in vendors if v.vendor_type == "wholesale_b2b"]

        if not retail_vendors:
            print("No retail vendors found! Run seed_data.py first.")
            return

        # Get deliverers
        result = await session.execute(select(Deliverer))
        deliverers = result.scalars().all()

        scenarios = [
            # Retail Scenarios
            {"vendor_type": "retail", "status": "delivered", "payment": "mpesa", "delivery_type": "quick_swap", "dist": 1.2, "qty": 2, "surcharges": {"payload": 0, "stair": 0}},
            {"vendor_type": "retail", "status": "picked_up", "payment": "mpesa", "delivery_type": "keep_my_bottle", "dist": 1.9, "qty": 4, "surcharges": {"payload": 0, "stair": 50}},
            {"vendor_type": "retail", "status": "pending", "payment": "cash", "delivery_type": "quick_swap", "dist": 0.5, "qty": 1, "surcharges": {"payload": 0, "stair": 0}},
            {"vendor_type": "retail", "status": "accepted", "payment": "mpesa", "delivery_type": "keep_my_bottle", "dist": 1.8, "qty": 3, "surcharges": {"payload": 0, "stair": 0}},
            
            # Wholesale Scenarios (requires MOQ >= 100kg, handled via qty and vehicle truck/tuktuk)
            {"vendor_type": "wholesale", "status": "delivered", "payment": "mpesa", "delivery_type": "standard", "dist": 8.5, "qty": 25, "surcharges": {"payload": 500, "stair": 0}},
            {"vendor_type": "wholesale", "status": "pending", "payment": "bank_transfer", "delivery_type": "standard", "dist": 12.0, "qty": 50, "surcharges": {"payload": 0, "stair": 0}},
            {"vendor_type": "wholesale", "status": "picked_up", "payment": "mpesa", "delivery_type": "standard", "dist": 4.2, "qty": 10, "surcharges": {"payload": 100, "stair": 0}},
        ]

        print(f"Seeding {len(scenarios)} perfect mathematically calculated orders...")

        for s in scenarios:
            v_type = s["vendor_type"]
            v_list = retail_vendors if v_type == "retail" else wholesale_vendors
            if not v_list:
                print(f"Skipping {v_type} scenario, no vendors.")
                continue
                
            vendor = random.choice(v_list)
            deliverer = random.choice(deliverers) if deliverers else None
            user = random.choice(users)
            
            # Generate customer location EXACTLY `dist` km away
            c_lat, c_lng = generate_point_at_distance(vendor.lat, vendor.lng, s["dist"])
            
            # Update user location for this order to match the exact math
            user.lat = c_lat
            user.lng = c_lng
            
            order_id = uuid.uuid4()
            
            # Select products
            result = await session.execute(select(Product).where(Product.vendor_id == vendor.id))
            products = result.scalars().all()
            if not products:
                continue
                
            prod = random.choice(products)
            
            # If wholesale, guarantee MOQ
            qty = s["qty"]
            if v_type == "wholesale":
                while prod.weight_kg * qty < 100.0:
                    qty += 5
            
            subtotal = prod.price * qty
            
            order_item = OrderItem(
                order_id=order_id,
                product_id=prod.id,
                quantity=qty,
                price=prod.price,
                Subtotal=subtotal
            )
            
            # Calculate Delivery Fee EXACTLY like backend
            vehicle_class = "motorbike"
            if qty > 4: vehicle_class = "tuktuk"
            if qty > 20: vehicle_class = "truck"
            
            fee_res = calculate_delivery_fee(
                lat_from=vendor.lat, lng_from=vendor.lng,
                lat_to=c_lat, lng_to=c_lng,
                vendor_type=vendor.vendor_type,
                vehicle_class=vehicle_class,
                wholesale_base=float(vendor.wholesale_base_delivery_fee or 0.0),
                wholesale_per_km=float(vendor.wholesale_per_km_fee or 0.0),
                delivery_type=s["delivery_type"]
            )
            
            delivery_fee = fee_res["fee"]
            
            # Surcharges
            payload_sur = s["surcharges"]["payload"]
            stair_sur = s["surcharges"]["stair"]
            
            # Revenue Splits & Bottle Deposit
            bottle_deposit = 0.0
            # Deposit is only charged when customer explicitly requests to keep/buy a new bottle
            if s["delivery_type"] == "keep_my_bottle":
                bottle_deposit = 300.0 * qty if prod.capacity == 20 else (150.0 * qty if prod.capacity == 10 else 0.0)
                
            # Revenue Splits
            revenue = calculate_revenue_splits(
                product_total=subtotal,
                delivery_fee=delivery_fee,
                vendor_type=vendor.vendor_type.value,
                bottle_deposit=bottle_deposit,
                rider_surcharges=payload_sur + stair_sur,
                delivery_type=s["delivery_type"],
                welcome_discount=0.0
            )
            
            # Total must include ALL fee components (matching order_service.py lines 689-693)
            total_amount = (
                subtotal + delivery_fee + revenue["service_fee"] + revenue["surge_fee"] +
                revenue["delivery_markup"] + payload_sur + stair_sur + bottle_deposit
            )
            
            # Payment status logic based on scenario
            p_status = "paid" if s["payment"] != "cash" and s["status"] in ["picked_up", "delivered"] else "pending"
            
            order = Order(
                id=order_id,
                customer_id=user.id,
                vendor_id=vendor.id,
                deliverer_id=deliverer.id if deliverer else None,
                delivery_address=f"Ngong Area, Distance: {s['dist']}km",
                lat_from=vendor.lat,
                lng_from=vendor.lng,
                lat=c_lat,
                lng=c_lng,
                total_amount=total_amount,
                order_status=s["status"],
                payment_status=p_status,
                payment_method=s["payment"],
                delivery_fee=delivery_fee,
                payload_surcharge=payload_sur,
                staircase_surcharge=stair_sur,
                delivery_time=fee_res["estimated_minutes"],
                delivery_type=s["delivery_type"],
                bottle_source="platform",
                vendor_commission=revenue["vendor_commission"],
                service_fee=revenue["service_fee"],
                rider_commission=revenue["rider_commission"],
                platform_total=revenue["platform_total"],
                vendor_net=revenue["vendor_net"],
                rider_net=revenue["rider_net"],
                surge_fee=revenue["surge_fee"],
                delivery_markup=revenue["delivery_markup"],
                product_subtotal=subtotal,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))
            )
            
            session.add(order)
            session.add(order_item)
            await session.flush()
        
        await session.commit()
        print("✅ Perfect mathematically accurate orders seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_perfect_orders())
