import asyncio
from sqlalchemy import text
from db.session import AsyncSessionLocal

async def wipe_db():
    async with AsyncSessionLocal() as session:
        # Use exact double-quoted table names for Postgres case-sensitivity
        await session.execute(text('TRUNCATE TABLE "Order_Items", "Orders", "Products", "Vendors", "Deliverers", "Users" CASCADE;'))
        await session.commit()
        print("✅ Database wiped successfully (TRUNCATE CASCADE).")

if __name__ == "__main__":
    asyncio.run(wipe_db())
