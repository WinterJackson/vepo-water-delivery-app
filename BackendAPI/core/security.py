from jose import jwt, JWTError
import httpx
import os 
import time
import logging

logger = logging.getLogger(__name__)

CLERK_ISSUER = os.getenv("CLERK_ISSUER")
CLERK_JWKS_URL  = os.getenv("CLERK_JWKS_URL")
FRONTEND_CLERK_API_KEY = os.getenv("FRONTEND_CLERK_API_KEY")

# F-023 FIX: JWKS cache with 1-hour TTL to avoid per-request HTTP calls
_jwks_cache: dict = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL = 3600  # 1 hour

async def _get_jwks() -> dict | None:
    """Fetch JWKS keys with caching. Returns None on failure."""
    if not CLERK_JWKS_URL:
        logger.error("CLERK_JWKS_URL is not configured")
        return None

    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < JWKS_CACHE_TTL:
        return _jwks_cache["keys"]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(CLERK_JWKS_URL)
            resp.raise_for_status()
            jwks = resp.json()
    except (httpx.HTTPError, Exception) as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        # Return stale cache if available, otherwise None
        return _jwks_cache["keys"]
    
    _jwks_cache["keys"] = jwks
    _jwks_cache["fetched_at"] = now
    return jwks

async def verify_clerk_token(token: str):
  jwks = await _get_jwks()
  if not jwks:
    logger.error("JWKS unavailable — cannot verify token")
    return None
    
  try:
    unverified_header = jwt.get_unverified_header(token)
    key = next((k for k in jwks["keys"] if k["kid"] == unverified_header["kid"] ), None)
    
    if not key:
      # Potential invalid auth token spoofing
      return None 

    payload = jwt.decode(
      token,
      key,
      algorithms=["RS256"],
      audience=FRONTEND_CLERK_API_KEY,
      issuer=CLERK_ISSUER,
    )
    return payload
  except (JWTError, KeyError, ValueError) as e:
    # Log securely without stack-traces for telemetry monitoring
    logger.warning(f"Token verification failed: {type(e).__name__}")
    return None

