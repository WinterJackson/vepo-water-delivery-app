from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import AsyncSessionLocal



async def get_db():
  async with AsyncSessionLocal() as session:
    try:
      yield session
    except Exception:
      await session.rollback()
      raise


@asynccontextmanager
async def get_db_session():
    """Standalone async context manager for non-FastAPI contexts (WebSocket, background tasks)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
