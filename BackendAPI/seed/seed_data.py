import asyncio
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import AsyncSessionLocal
from models.deliverer_model import Deliverer
from models.product_model import Product
from models.vendor_model import Vendor
from datetime import datetime, time, timezone
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
import random
import uuid
import math

faker = Faker()

# Cloudinary Image URLs
productImages = [
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749059743/zjfoz5vc9pw9dzn7jpuh.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749059894/wsoofb5s4g9yct2vflzl.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749059929/rm2385bzx9z6exlagnnb.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749059961/f7gcwn9morh82qxrqez6.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749059986/urtwpykytnl6ilwpppgm.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060012/qi85i3x93rndfzj3ns3r.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060048/kwcms2i9ezc33qn3a5il.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060077/qroz7nc5gzmbp5eoknjk.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060111/cogawqlc2vhypwrflrxn.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060134/hdpjyjykk5oqi6jd7kdw.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060169/rctalphfnadgl3dscsfa.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060201/bmpltj6ls6gytzxfblnk.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060228/grj3hiy2y4cjefodlden.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060251/veowb8nguwwlboirlgho.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060281/vwioru36ccaxa2vwrat9.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060308/vwbrtlmth8wtbllnlmac.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060330/dquatvstkcpxbepwiiv7.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060365/an2uop1xk4gg7zk3pqx2.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060380/tci21dklgnygb1uaocju.jpg"
]

vendorProfilePics = [
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749060801/kzhsjnh5e4ka30jr0qtv.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749065804/inei0y4cgkfjum6qy0hk.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749065832/dhocfdjhnxrrsukbqw0k.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749065850/htookfvdhxsgmm8zp5d0.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1749065901/grykkgxrdfxqd5fxxs65.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751196927/pumoscycxnpcdawqvjw6.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751196965/ckrydko59jcjpwgfa281.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751196993/jph6edbeygnpeybc2gda.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197089/tyy6re4fbabmrgrfr3h4.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197120/ahex7trvp8prpuhnurpc.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197145/tsy3ynpathioxw5gulyi.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197167/j7io7ev3xvnjqesnv0x7.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197189/gks6j8oon4lsaw1ozcph.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197238/bjndizyuli3mrxo030zg.jpg",
    "https://res.cloudinary.com/dn5f0jksu/image/upload/v1751197261/eqdvvigrij2iv3rjmcpv.jpg"
]

# ─── Realistic Kenyan Locations ──────────────────────────────────────────────
# Each entry: (location_address, lat, lng) — Strictly around Ngong Town and Matasia
KENYA_VENDOR_LOCATIONS = [
    ("Ngong Town, Oloolua Road", -1.3615, 36.6570),
    ("Ngong Town, Milele Mall Area", -1.3630, 36.6555),
    ("Ngong Town, Zambia Road", -1.3650, 36.6540),
    ("Ngong Town, Scheme", -1.3590, 36.6600),
    ("Ngong Town, Lemelepo", -1.3670, 36.6520),
    ("Matasia, Magadi Road", -1.3850, 36.6667),
    ("Matasia, Memusi Area", -1.3870, 36.6680),
    ("Matasia, Olkeri", -1.3820, 36.6640),
    ("Matasia, Merisho Road", -1.3890, 36.6700),
    ("Matasia, Kiserian Road Junction", -1.3910, 36.6720),
]

# ─── Realistic Kenyan Vendor Business Names ──────────────────────────────────
KENYA_VENDOR_NAMES = [
    ("John Ole Kipito", "Ngong Springs Water Co."),
    ("Mary Wanjiku", "Matasia Pure Drops"),
    ("David Njoroge", "Oloolua Aqua Suppliers"),
    ("Sarah Nekesa", "Milele Fresh Water"),
    ("Peter Kamau", "Zambia Road Water Hub"),
    ("Faith Mutheu", "Memusi Crystal Water"),
    ("Joseph Ndung'u", "Olkeri Safe Water"),
    ("Grace Akinyi", "Ngong Hills Pure Water"),
    ("Daniel Ochieng", "Merisho Flow Suppliers"),
    ("Rose Wambui", "Kiserian Junction Aqua"),
]

# ─── Realistic Product Templates ─────────────────────────────────────────────
RETAIL_PRODUCTS = [
    ("Premium Purified 20L Refill", 20.0, 20.5, "bottle", 1, (150, 350), "dispenser_refill"),
    ("Standard 18.9L Dispenser Bottle", 18.9, 19.5, "bottle", 1, (120, 280), "dispenser_refill"),
    ("Alkaline 20L Refill", 20.0, 20.5, "bottle", 1, (250, 450), "dispenser_refill"),
    ("Spring Water 20L Refill", 20.0, 20.5, "bottle", 1, (200, 400), "dispenser_refill"),
    ("5L Household Jerrycan", 5.0, 5.2, "jerrycan", 2, (80, 150), "jerrycan"),
    ("10L Family Jerrycan", 10.0, 10.3, "jerrycan", 1, (120, 220), "jerrycan"),
    ("Hot & Cold Water Dispenser", 0.0, 15.0, "unit", 1, (8000, 25000), "dispensers_coolers"),
    ("Bottle Water Pump Dispenser", 0.0, 0.5, "unit", 1, (500, 1500), "accessories"),
]

WHOLESALE_PRODUCTS = [
    ("Bale 500ml Branded Water (24-pack)", 0.5, 12.5, "pack", 1, (450, 550), "bulk_wholesale"),
    ("Bale 1L Branded Water (12-pack)", 1.0, 12.5, "pack", 1, (480, 550), "bulk_wholesale"),
    ("10L Dispatch Branded Water", 10.0, 10.3, "bottle", 1, (280, 350), "bulk_wholesale"),
    ("20L Bulk Dispatch", 20.0, 20.5, "bottle", 1, (500, 600), "bulk_wholesale"),
]

WHOLESALE_VENDOR_NAMES = [
    ("Samuel Mwangi", "Mega Bulk Waters Ngong"),
    ("Grace Akinyi", "Lake Bulk Supplies Matasia"),
    ("Peter Ochieng", "Oloolua Water Depot"),
    ("David Njoroge", "Matasia Mega Wholesale"),
    ("John Kariuki", "Kiserian Bulk Water Hub"),
    ("Kevin Wanjala", "Ngong Town Water Wholesalers"),
]


async def seed_deliverers():
    async with AsyncSessionLocal() as session:
        for _ in range(30):
            lat = random.uniform(-1.45, -1.10)
            lng = random.uniform(36.65, 37.00)

            deliverer = Deliverer(
                id=uuid.uuid4(),
                name=faker.name(),
                email=faker.unique.email(),
                phone_number=faker.phone_number(),
                profile_pic=faker.image_url(),
                driver_license=faker.file_path(extension='pdf'),
                ID_number=faker.unique.ssn(),
                vehicle_type=random.choice(["motorbike", "tuktuk", "truck"]),
                plate_number=faker.license_plate(),
                current_lat=lat,
                current_lng=lng,
                location=from_shape(Point(lng, lat), srid=4326),
                is_available=True,
                is_active=False,
                is_verified=False,
                shift_start=time(7, 0),
                shift_end=time(19, 0),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(deliverer)
        await session.commit()
        print("✅ Deliverers seeded.")


async def seed_vendors_and_products():
    async with AsyncSessionLocal() as session:
        # 1. SEED 15 RETAIL VENDORS (2km radius)
        for i in range(15):
            loc = KENYA_VENDOR_LOCATIONS[i % len(KENYA_VENDOR_LOCATIONS)]
            vendor_info = KENYA_VENDOR_NAMES[i % len(KENYA_VENDOR_NAMES)]
            lat = loc[1] + random.uniform(-0.005, 0.005)
            lng = loc[2] + random.uniform(-0.005, 0.005)

            vendor = Vendor(
                owners_name=vendor_info[0],
                vendor_type="retail_refill",
                business_name=vendor_info[1],
                email=faker.unique.email(),
                phone_number=f"+2547{random.randint(10000000, 99999999)}",
                profile_pic=random.choice(vendorProfilePics),
                business_license=faker.file_path(),
                location_address=loc[0],
                lat=lat,
                lng=lng,
                location=from_shape(Point(lng, lat), srid=4326),
                delivery_radius=2.0,
                shift_start=time(7, 0),
                shift_end=time(19, 0),
                verification_status="pending",
                rating=round(random.uniform(3.5, 5.0), 1),
                total_sales=random.randint(10, 500),
                sales_amount=round(random.uniform(5000, 100000), 2),
                preferred_payment_method=["cash", "mpesa"],
                deposit_fee=600.0,
            )
            session.add(vendor)
            await session.flush()

            templates = random.sample(RETAIL_PRODUCTS, k=min(6, len(RETAIL_PRODUCTS)))
            for j, tmpl in enumerate(templates):
                name, capacity, weight, unit, min_qty, price_range, category = tmpl
                if unit in ["bottle", "jerrycan"] and capacity > 0:
                    price_per_litre = random.choice([5.0, 10.0])
                    price = round(capacity * price_per_litre, 2)
                    required_qty_for_10L = math.ceil(10.0 / capacity)
                    min_qty = max(min_qty, required_qty_for_10L)
                else:
                    price = round(random.uniform(*price_range), 2)
                
                product = Product(
                    vendor_id=vendor.id,
                    name=name,
                    description=f"High-quality {name.lower()} from {vendor_info[1]}. Sourced and purified to Kenyan KEBS standards.",
                    image_url=random.choice(productImages),
                    price=price,
                    discount=0.0,
                    capacity=capacity,
                    weight_kg=weight,
                    minimum_order_qty=min_qty,
                    unit=unit,
                    stock=random.randint(20, 200),
                    category=category,
                )
                session.add(product)

        # 2. SEED 6 WHOLESALE VENDORS (10km radius)
        for i in range(6):
            loc = KENYA_VENDOR_LOCATIONS[i % len(KENYA_VENDOR_LOCATIONS)]
            vendor_info = WHOLESALE_VENDOR_NAMES[i]
            lat = loc[1] + random.uniform(-0.005, 0.005)
            lng = loc[2] + random.uniform(-0.005, 0.005)

            vendor = Vendor(
                owners_name=vendor_info[0],
                vendor_type="wholesale_b2b",
                business_name=vendor_info[1],
                email=faker.unique.email(),
                phone_number=f"+2547{random.randint(10000000, 99999999)}",
                profile_pic=random.choice(vendorProfilePics),
                business_license=faker.file_path(),
                location_address=loc[0],
                lat=lat,
                lng=lng,
                location=from_shape(Point(lng, lat), srid=4326),
                delivery_radius=10.0,
                shift_start=time(6, 0),
                shift_end=time(18, 0),
                verification_status="pending",
                rating=round(random.uniform(4.0, 5.0), 1),
                total_sales=random.randint(100, 1000),
                sales_amount=round(random.uniform(50000, 500000), 2),
                preferred_payment_method=["cash", "mpesa", "bank_transfer"],
                deposit_fee=600.0,
                wholesale_base_delivery_fee=150.0,
                wholesale_per_km_fee=100.0,
            )
            session.add(vendor)
            await session.flush()

            for j, tmpl in enumerate(WHOLESALE_PRODUCTS):
                name, capacity, weight, unit, min_qty, price_range, category = tmpl
                price = round(random.uniform(*price_range), 2)
                
                product = Product(
                    vendor_id=vendor.id,
                    name=name,
                    description=f"Bulk {name.lower()} from {vendor_info[1]}. Ready for immediate wholesale dispatch.",
                    image_url=random.choice(productImages),
                    price=price,
                    discount=0.0,
                    capacity=capacity,
                    weight_kg=weight,
                    minimum_order_qty=min_qty,
                    unit=unit,
                    stock=random.randint(100, 1000),
                    category=category,
                )
                session.add(product)

        await session.commit()
        print("✅ Vendors and products seeded.")

async def main():
    await seed_deliverers()
    await seed_vendors_and_products()

if __name__ == "__main__":
    asyncio.run(main())
