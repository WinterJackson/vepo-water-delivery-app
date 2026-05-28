from db.session import engine, Base
import asyncio

# models import
from models.cart_model import Cart, CartItem
from models.deliverer_model import Deliverer
from models.favorites_model import Favorite
from models.notification_model import Notification
from models.order_model import Order, OrderItem
from models.product_model import Product
from models.user_model import User
from models.vendor_model import Vendor


async def reset_database():
    async with engine.begin() as conn:
        print("🔴 Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("✅ All tables dropped.")

        print("🟢 Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("✅ All tables created.")


if __name__ == "__main__":
    asyncio.run(reset_database())
