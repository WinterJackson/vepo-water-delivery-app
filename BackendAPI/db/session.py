from sqlalchemy.orm import sessionmaker, declarative_base
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import AsyncAdaptedQueuePool


from dotenv import load_dotenv

load_dotenv()  # Load variables from .env

import ssl as _ssl

DATABASE_URL = os.getenv("NEONDB_URL")

# asyncpg does not accept sslmode/channel_binding as URL query params — strip them
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?")[0]

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",  # F-031 FIX
    pool_pre_ping=True,
    pool_recycle=1800,
    poolclass=AsyncAdaptedQueuePool,  # F-027 FIX: real pool, not NullPool
    pool_size=5,
    max_overflow=10,
    connect_args={"ssl": True},
)
AsyncSessionLocal = sessionmaker (bind=engine, class_=AsyncSession, autoflush=False, expire_on_commit=False)

Base = declarative_base()

async def create_table():
  async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)