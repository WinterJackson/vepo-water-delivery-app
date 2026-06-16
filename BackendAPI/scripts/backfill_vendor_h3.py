import asyncio
import sys
import os
import h3

# Ensure BackendAPI is in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.session import AsyncSessionLocal
from models.vendor_model import Vendor

async def run_backfill():
    async with AsyncSessionLocal() as session:
        query = select(Vendor).where(Vendor.lat.isnot(None), Vendor.lng.isnot(None), Vendor.h3_index_res8.is_(None))
        result = await session.execute(query)
        vendors = result.scalars().all()

        count = 0
        for vendor in vendors:
            h3_index = h3.latlng_to_cell(vendor.lat, vendor.lng, 8)
            vendor.h3_index_res8 = str(h3_index)
            count += 1

        await session.commit()
        print(f"Successfully backfilled {count} vendors with H3 index at resolution 8.")

if __name__ == "__main__":
    asyncio.run(run_backfill())
