import redis.asyncio as redis
import os
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Upstash provides rediss:// (with two s) for TLS connections
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Create a connection pool to Upstash / Local Redis
# decode_responses=True automatically decodes byte strings to Python strings
try:
    redis_pool = redis.ConnectionPool.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to initialize Redis connection pool: {e}")
    redis_pool = None

def get_redis() -> Optional[redis.Redis]:
    if not redis_pool:
        return None
    return redis.Redis(connection_pool=redis_pool)

async def cache_get(key: str) -> Optional[Any]:
    r = get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        if val:
            return json.loads(val)
    except Exception as e:
        logger.warning(f"Redis GET error for key '{key}': {e}")
    return None

async def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> bool:
    r = get_redis()
    if not r:
        return False
    try:
        val_str = json.dumps(value)
        await r.setex(key, ttl_seconds, val_str)
        return True
    except Exception as e:
        logger.warning(f"Redis SET error for key '{key}': {e}")
    return False

async def cache_delete(key: str) -> bool:
    r = get_redis()
    if not r:
        return False
    try:
        await r.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Redis DELETE error for key '{key}': {e}")
    return False
