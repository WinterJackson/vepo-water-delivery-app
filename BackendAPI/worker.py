import asyncio
import logging
import os
from arq import Worker
from arq.connections import RedisSettings
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ARQ Redis Settings mapping to the app's REDIS_URL
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

# Extract host, port, db from URL to construct RedisSettings (simplistic parse for standard upstash/redis urls)
# Upstash uses rediss:// and requires ssl=True in standard redis, but for ARQ it accepts standard redis.asyncio pool.
# We will just pass the from_url connection pool to ARQ if possible, or use standard RedisSettings.from_url() in a custom way.
# ARQ has RedisSettings.from_dsn(redis_url) but we have to ensure it handles "rediss://" correctly.
# According to ARQ docs: RedisSettings.from_dsn(url) handles standard urls.

# If the URL is an upstash rediss:// url, ARQ might complain if it doesn't recognize it.
if redis_url.startswith("rediss://"):
    # Upstash typically doesn't need strict SSL cert checks in Python redis driver, but passing the DSN usually works.
    pass

redis_settings = RedisSettings.from_dsn(redis_url)

# --- Background Task Functions ---

async def startup(ctx):
    logger.info("ARQ Worker starting up...")

async def shutdown(ctx):
    logger.info("ARQ Worker shutting down...")

async def send_push_message_task(ctx, to_tokens, title, body, data=None):
    from services.expo_push_service import _execute_push_chunks
    logger.info(f"ARQ Worker Processing Push Notification to {len(to_tokens)} recipients.")
    await _execute_push_chunks(to_tokens, title, body, data)
    return f"Processed {len(to_tokens)} tokens"

async def flush_gps_tracking_logs_task(ctx):
    from services.deliverer_service import flush_tracking_logs
    await flush_tracking_logs()
    return "Flushed tracking logs"

class WorkerSettings:
    functions = [
        send_push_message_task,
        flush_gps_tracking_logs_task,
    ]
    redis_settings = redis_settings
    on_startup = startup
    on_shutdown = shutdown
    # Automatically execute cron jobs
    cron_jobs = []

# To add the cron job for flush_gps_tracking_logs_task:
from arq.cron import cron

WorkerSettings.cron_jobs = [
    cron(flush_gps_tracking_logs_task, second=set(range(0, 60, 10))) # Runs every 10 seconds
]
