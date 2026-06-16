import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from main import app
from db.session import Base
from dependencies.dependencies import get_db

# Use an in-memory SQLite for testing (limited PostGIS support, but works for logic tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from sqlalchemy.types import String

def visit_TSVECTOR(self, type_, **kw):
    return self.visit_string(String(), **kw)
SQLiteTypeCompiler.visit_TSVECTOR = visit_TSVECTOR

def visit_ARRAY(self, type_, **kw):
    return self.visit_string(String(), **kw)
SQLiteTypeCompiler.visit_ARRAY = visit_ARRAY

def visit_JSONB(self, type_, **kw):
    return self.visit_string(String(), **kw)
SQLiteTypeCompiler.visit_JSONB = visit_JSONB

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    from unittest.mock import AsyncMock
    yield AsyncMock()


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
