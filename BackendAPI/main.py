
from dotenv import load_dotenv

load_dotenv()

import os
import logging
from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from routes import (
    vendor_routes, auth_routes, product_routes, cart_routes,
    query_routes, vendor_management_routes, deliverer_routes,
    websocket_routes, review_routes, payout_routes, sync_routes, sms_routes,
    favorites_routes, notification_routes, delivery_fee_routes, refund_routes,
    vendor_remittance_routes, vendor_favorites_routes, saved_location_routes
)
import models
from db.session import create_table
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        return response

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Drop Water Delivery API", version="1.0.0")

# --- F-011 FIX: Health Check Endpoint ---
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.get("/api/app-version", tags=["App Version"])
async def get_app_version():
    return {
        "min_version": "1.0.0",
        "ios_store_url": "https://apps.apple.com/app/drop/id123456789",
        "android_store_url": "https://play.google.com/store/apps/details?id=com.drop.app"
    }

# --- F-012 FIX: Global Exception Handler (prevents stack trace leaks) ---
from fastapi import Request as FastAPIRequest
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: FastAPIRequest, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: FastAPIRequest, exc: RequestValidationError):
    logger.warning(f"422 on {request.method} {request.url.path}: {exc.errors()} | Body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)[:500]},
    )

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# --- CORS Configuration ---
_env_mode = os.getenv("ENV", "development")
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins:
    ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
elif _env_mode == "development":
    ALLOWED_ORIGINS = ["*"]
else:
    ALLOWED_ORIGINS = []  # No wildcard in production — must be explicit

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

# Apply global payload compression (down to 500 bytes minimum to save processing overhead)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Trust Proxy Headers (Critical for Safaricom IP whitelisting on Render/Heroku)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# Apply Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# --- Customer-facing Routes ---
app.include_router(vendor_routes.router, prefix="/api")
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(product_routes.router, prefix="/api")
app.include_router(cart_routes.router, prefix="/api/cart")
app.include_router(query_routes.router, prefix="/api")
app.include_router(delivery_fee_routes.router, prefix="/api", tags=["Delivery Fee"])
app.include_router(saved_location_routes.router, prefix="/api/auth", tags=["Saved Locations"])

# --- Vendor-facing Routes ---
app.include_router(vendor_management_routes.router, prefix="/api/vendor", tags=["Vendor Management"])
from routes import vendor_rider_routes
app.include_router(vendor_rider_routes.router, prefix="/api/vendor", tags=["Vendor Rider Registry"])

# --- Admin Routes ---
from routes import admin_routes
app.include_router(admin_routes.router, prefix="/api/admin", tags=["Admin Dashboard"])

# --- Rider-facing Routes ---
from routes import deliverer_routes, rider_vendor_routes, deliverer_kyc_routes
app.include_router(deliverer_routes.router, prefix="/api/rider", tags=["Rider"])
app.include_router(rider_vendor_routes.router, prefix="/api/rider", tags=["Rider Vendor Reg"])
app.include_router(deliverer_kyc_routes.router)

# --- Unification Routes ---
app.include_router(review_routes.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(favorites_routes.router, prefix="/api/favorites", tags=["Favorites"])
app.include_router(vendor_favorites_routes.router, prefix="/api/vendor-favorites", tags=["Vendor Favorites"])
app.include_router(notification_routes.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(payout_routes.router, prefix="/api/payouts", tags=["Payouts"])
app.include_router(refund_routes.router, prefix="/api/refunds", tags=["Refunds"])
app.include_router(sync_routes.router, prefix="/api/sync", tags=["Sync"])
app.include_router(sms_routes.router, prefix="/api/sms", tags=["SMS Fallback"])
app.include_router(vendor_remittance_routes.router, prefix="/api/vendor_remittance", tags=["VendorRemittance"])
from routes import contact_routes
app.include_router(contact_routes.router, prefix="/api", tags=["Contacts"])


# --- WebSocket Routes ---
app.include_router(websocket_routes.router, tags=["WebSocket"])
