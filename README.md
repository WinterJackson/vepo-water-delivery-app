# 💧 Drop — Multivendor Water Delivery Platform

> A production-grade, Kenya-focused multivendor water delivery marketplace built with FastAPI, React Native (Expo), and PostgreSQL. Three specialized apps — Customer, Vendor, and Rider — connected through a single shared API.

---

## 📦 Repository Structure

```
Multivendor-Water-Delivery-App/
├── BackendAPI/          # FastAPI backend (shared by all 3 apps)
├── drop-customer-app/   # Customer-facing Expo app ("Drop")
├── drop-rider-app/      # Rider/delivery agent Expo app ("Drop Rider")
├── drop-vendor-app/     # Vendor/store manager Expo app ("Drop Vendor")
└── docker-compose.yml   # Local PostgreSQL + Redis dev stack
```

---

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Customer App   │    │   Vendor App    │    │   Rider App     │
│  (drop-customer)│    │  (drop-vendor)  │    │  (drop-rider)   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │ HTTPS + WebSocket
                    ┌───────────▼───────────┐
                    │     BackendAPI        │
                    │     FastAPI + ARQ     │
                    └───────────┬───────────┘
                    ┌───────────┼───────────┐
                    │           │           │
               ┌────▼────┐ ┌───▼───┐ ┌────▼────┐
               │Postgres │ │ Redis │ │AWS S3   │
               │PostGIS  │ │Pub/Sub│ │(KYC/IMG)│
               └─────────┘ └───────┘ └─────────┘
```

---

## 🔄 Business Workflow Overview

### Order Lifecycle (State Machine)
```
pending → unassigned → accepted → preparing → ready → picked_up → delivered
                                                            ↓
                                                    pending_review (bottle dispute)
                                                    mismatch_pending (quantity issue)
```

### The Full Delivery Flow

1. **Customer** browses vendors, adds water to cart, and checks out via **M-Pesa STK Push**
2. **Backend** confirms payment via M-Pesa callback, creates an `Order` with status `unassigned`
3. **Auto-dispatch engine (Tier 1)** checks if the vendor has an available in-house rider → assigns directly
4. **Trip Radar (Tier 2)** broadcasts the order to eligible gig economy riders near the vendor
5. **Rider** sees the order on Trip Radar, accepts it → status changes to `accepted`
6. **Vendor** prepares the order → marks `preparing` → then `ready` for pickup
7. **Rider** picks up (`picked_up`) and navigates to customer using live map
8. **Customer** tracks rider in real-time via WebSocket
9. **Rider** completes delivery:
   - Normal: marks `delivered` → wallet credits fire atomically
   - Bottle rejection: flags `pending_review` → admin adjudicates (auto-resolved after 3 minutes via ARQ)
   - Quantity mismatch: flags `mismatch_pending` for vendor review
10. **Customer** rates the delivery (optional) → rider's rating/acceptance_rate updated

---

## 💰 Revenue Model

| Participant     | Retail (B2C)              | Wholesale (B2B)              |
|-----------------|---------------------------|------------------------------|
| **Platform**    | 5% vendor commission + KSH 12 service fee | 2.5% commission + KSH 50 service fee |
| **Rider (Gig)** | 90% of delivery fee (10% commission) | 90% of delivery fee |
| **Rider (Platinum)** | 93% of delivery fee (7% commission) | 93% of delivery fee |
| **Rider (In-House)** | 100% of delivery fee (0% commission) | 100% of delivery fee |
| **Vendor**      | Product revenue minus commission | Product revenue minus commission |

**Surge Pricing**: +KSH 10 during peak hours (06:00–08:00, 17:00–19:00 EAT)

---

## 🗺️ Geospatial Rules

| Rule                   | Retail (retail_refill) | Wholesale (wholesale_b2b) |
|------------------------|------------------------|---------------------------|
| Max delivery distance  | 2 km                   | 15 km (city-wide)         |
| Max items per order    | 4 × 20L bottles        | 200 bottles               |
| Min order weight (MOQ) | None                   | 100 kg                    |
| Rider search radius    | 2 km from vendor       | 15 km from vendor         |
| Vehicle types          | Motorbike only         | Motorbike / Tuktuk / Truck |

---

## 🔑 Authentication

All three apps use **[Clerk](https://clerk.com/)** for authentication (OAuth, email/password, phone OTP). Each app type (customer, vendor, rider) has a distinct Clerk JWT, which the backend validates via `clerk-backend-api`. The JWT `sub` claim is the `clerk_id` linking to the correct database entity.

---

## 🧰 Tech Stack

### Backend
- **Runtime**: Python 3.12, FastAPI 0.115, Uvicorn
- **Database**: PostgreSQL (PostGIS enabled), SQLAlchemy 2.0 async, Alembic migrations
- **Cache/Queue**: Redis (Upstash), ARQ background workers
- **Payments**: Safaricom M-Pesa STK Push (C2B) + B2C for payouts
- **Storage**: AWS S3 (AES-256 encrypted, presigned URLs for KYC)
- **Auth**: Clerk Backend API (JWT RS256)
- **Real-time**: WebSocket + Redis Pub/Sub
- **Observability**: Sentry, Prometheus, structured JSON logging with correlation IDs
- **Geospatial**: H3 hex indexing (resolution 8), GeoAlchemy2/PostGIS
- **Notifications**: Expo Push Notification Service (via `exponent_server_sdk`)

### Frontend (all 3 apps)
- **Framework**: Expo SDK 54, React Native 0.81, React 19
- **Navigation**: Expo Router 6 (file-based)
- **Auth**: `@clerk/clerk-expo`
- **State/Cache**: TanStack Query v5, Zustand v5
- **Styling**: NativeWind v4 (Tailwind CSS for RN), BRAND design tokens
- **Real-time**: WebSocket via `socket.io-client`
- **Maps**: `react-native-maps` + Google Maps API
- **Notifications**: `expo-notifications`
- **Image Upload**: `expo-image-manipulator` (WebP compression) → Backend → AWS S3

---

## 🚀 Local Development

### Prerequisites
- Docker & Docker Compose (for PostgreSQL + Redis)
- Python 3.12 + `venv`
- Node.js 20+ + pnpm
- Expo CLI
- Android emulator or physical device

### 1. Start Infrastructure
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd BackendAPI
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in secrets
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### 3. Customer App
```bash
cd drop-customer-app
pnpm install
# Set EXPO_PUBLIC_BACKEND_BASE_URL in .env
expo start
```

### 4. Rider App
```bash
cd drop-rider-app
pnpm install
expo start
```

### 5. Vendor App
```bash
cd drop-vendor-app
pnpm install
expo start
```

---

## 📋 Environment Variables (Backend)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `REDIS_URL` | Redis/Upstash connection string (`rediss://` for TLS) |
| `CLERK_SECRET_KEY` | Clerk backend secret for JWT verification |
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 uploads |
| `AWS_REGION` | AWS region (default `us-east-1`) |
| `S3_BUCKET_NAME` | S3 bucket for KYC and delivery proof images |
| `MPESA_CONSUMER_KEY` | Safaricom M-Pesa API key |
| `MPESA_CONSUMER_SECRET` | Safaricom M-Pesa secret |
| `MPESA_SHORTCODE` | M-Pesa business shortcode |
| `MPESA_PASSKEY` | M-Pesa STK Push passkey |
| `MPESA_CALLBACK_URL` | Public URL for M-Pesa payment callbacks |
| `SENTRY_DSN` | Sentry DSN for error tracking (optional) |
| `ENV` | `development` or `production` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (production) |

---

## 📱 App-specific Env Variables (all 3 Frontend apps)
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_BACKEND_BASE_URL` | Full URL to the backend API |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps SDK key |

---

## 📚 Documentation

- [Backend API Reference](./BackendAPI/README.md)
- [Customer App](./drop-customer-app/README.md)
- [Rider App](./drop-rider-app/README.md)
- [Vendor App](./drop-vendor-app/README.md)
