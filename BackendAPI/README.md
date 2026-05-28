# Backend API

## Required Environment Variables

To run the backend securely without committing secrets to the repository, create a `.env` file in the root of the `BackendAPI` folder. 

Refer to the structure below for the required keys. Do **not** commit the values of these variables.

```env
# ── Required ──────────────────────────────────────────────
NEONDB_URL=""
ALLOWED_ORIGINS=""

# ── Auth (Clerk) ──────────────────────────────────────────
CLERK_ISSUER=""
CLERK_JWKS_URL=""
FRONTEND_CLERK_API_KEY=""

# ── M-Pesa (Daraja) ──────────────────────────────────────
MPESA_CONSUMER_KEY=""
MPESA_CONSUMER_SECRET=""
MPESA_SHORTCODE=""
MPESA_PASSKEY=""
MPESA_CALLBACK_URL=""
MPESA_BASE_URL=""

# ── Email ─────────────────────────────────────────────────
RESEND_API_KEY=""
EMAIL_FROM=""

# ── Optional ──────────────────────────────────────────────
ENV=""
SQL_ECHO=""
```
