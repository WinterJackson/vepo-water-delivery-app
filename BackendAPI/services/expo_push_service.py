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

async def send_push_message(to: str, title: str, body: str, data: Optional[dict] = None):
    if not to or not to.startswith("ExponentPushToken"):
        logger.warning(f"Invalid push token: {to}")
        return None

    messages = [{
        "to": to,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }]
    
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            response = await shared_client.post(EXPO_PUSH_URL, json=messages)
            response.raise_for_status()
            res_data = response.json()
            
            # BUG-PSH-01 FIX: Parse for DeviceNotRegistered and auto-purge stale tokens
            if res_data and "data" in res_data:
                for entry in res_data["data"]:
                    if entry.get("status") == "error":
                        error_type = entry.get("details", {}).get("error")
                        if error_type == "DeviceNotRegistered":
                            logger.info(f"Token {to} is dead (DeviceNotRegistered). Purging from DB.")
                            asyncio.create_task(purge_dead_token(to))

            logger.info(f"Push notification sent successfully to {to}")
            return res_data
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500 and attempt < max_retries:
                logger.warning(f"Push notification 5xx error, retrying {attempt+1}/{max_retries}: {e}")
                await asyncio.sleep(1.0 * (attempt + 1))
                continue
            else:
                logger.error(f"Failed to send push notification HTTP error: {e}")
                return None
        except Exception as e:
            if attempt < max_retries:
                logger.warning(f"Push notification transient error, retrying {attempt+1}/{max_retries}: {e}")
                await asyncio.sleep(1.0 * (attempt + 1))
                continue
            else:
                logger.error(f"Failed to send push notification: {str(e)}")
                return None
