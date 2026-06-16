import httpx
import logging
import asyncio
from typing import Optional
from sqlalchemy import update

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def purge_dead_token(token: str):
    try:
        from dependencies.dependencies import get_db_session
        from models.user_model import User
        from models.vendor_model import Vendor
        from models.deliverer_model import Deliverer
        
        async with get_db_session() as session:
            await session.execute(update(User).where(User.push_token == token).values(push_token=None))
            await session.execute(update(Vendor).where(Vendor.push_token == token).values(push_token=None))
            await session.execute(update(Deliverer).where(Deliverer.push_token == token).values(push_token=None))
            await session.commit()
    except Exception as e:
        logger.error(f"Failed to purge dead token from DB: {e}")

shared_client = httpx.AsyncClient(timeout=10.0)

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.RequestError)),
    reraise=True
)
async def _execute_push_chunks(tokens: list[str], title: str, body: str, data: Optional[dict] = None):
    """The actual background worker function that sends messages in chunks of 100."""
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return None

    chunk_size = 100
    all_responses = []

    for i in range(0, len(valid_tokens), chunk_size):
        chunk = valid_tokens[i:i + chunk_size]
        messages = [{
            "to": to,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {}
        } for to in chunk]
        
        try:
            response = await shared_client.post(EXPO_PUSH_URL, json=messages)
            response.raise_for_status()
            res_data = response.json()
            all_responses.append(res_data)
            
            # Parse for DeviceNotRegistered and auto-purge stale tokens
            if res_data and "data" in res_data:
                for idx, entry in enumerate(res_data["data"]):
                    if entry.get("status") == "error":
                        error_type = entry.get("details", {}).get("error")
                        if error_type == "DeviceNotRegistered":
                            dead_token = chunk[idx]
                            logger.info(f"Token {dead_token} is dead (DeviceNotRegistered). Purging from DB.")
                            asyncio.create_task(purge_dead_token(dead_token))
        except Exception as e:
            logger.error(f"Failed to send push chunk: {e}", exc_info=True)

    return all_responses

async def send_chunked_push_messages(tokens: list[str], title: str, body: str, data: Optional[dict] = None):
    """Enqueues chunked push messages via ARQ."""
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return None

    try:
        from core.redis_client import get_arq_pool
        pool = await get_arq_pool()
        if pool:
            await pool.enqueue_job('send_push_message_task', valid_tokens, title, body, data)
            logger.info(f"Enqueued {len(valid_tokens)} push notifications to ARQ.")
            return True
        else:
            logger.warning("ARQ pool not available, running push notifications synchronously.")
            # Fallback to local synchronous processing
            await _execute_push_chunks(valid_tokens, title, body, data)
            return True
    except Exception as e:
        logger.error(f"Failed to enqueue push message to ARQ: {e}")
        return False

async def send_push_message(to: str, title: str, body: str, data: Optional[dict] = None):
    """Backwards compatible single-token push. Enqueues via ARQ."""
    if not to or not to.startswith("ExponentPushToken"):
        logger.warning(f"Invalid push token: {to}")
        return None
        
    return await send_chunked_push_messages([to], title, body, data)
