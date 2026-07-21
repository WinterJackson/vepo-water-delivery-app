# Drop Backend API ⚙️

> The unified FastAPI backend powering the Drop Multivendor Water Delivery Platform (Customer, Vendor, and Rider apps).

## 🏛️ Architecture

The backend is built as a monolithic service that handles all business logic, data persistence, and real-time communication for the three mobile apps.

- **FastAPI**: High-performance asynchronous REST framework.
- **PostgreSQL + PostGIS**: Relational database with advanced geospatial querying capabilities for location-based vendor/rider discovery.
- **SQLAlchemy 2.0**: Asynchronous ORM.
- **Redis**: In-memory data store used for WebSocket Pub/Sub (horizontal scaling) and rate-limiting.
- **ARQ**: Asynchronous Redis Queue for background jobs (e.g., auto-resolving disputes, batch location tracking).

## 🚀 Key Modules

- `/models`: SQLAlchemy ORM definitions mapping to PostgreSQL tables.
- `/schemas`: Pydantic models for data validation, serialization, and API request/response documentation.
- `/routes`: API endpoints grouped by domain (`customer_routes.py`, `vendor_routes.py`, `rider_routes.py`, `auth_routes.py`, `websocket_routes.py`).
- `/services`: Core business logic (e.g., `order_service.py`, `dispatch_policy.py`).
- `/core`: App configuration, database session management, security, and Redis initialization.

## 🔐 Security & KYC

- **Authentication**: JWT validation via Clerk (`clerk-backend-api`).
- **Authorization**: Role-based access control (RBAC). Routes are prefixed and guarded by dependencies ensuring only the correct entity type (e.g., Vendor vs Rider) can access them.
- **Secure Uploads**: KYC documents and Proof-of-Delivery photos are uploaded to private AWS S3 buckets. The API serializes these private S3 keys into 15-minute presigned URLs on the fly using Pydantic `field_validators`, ensuring secure, ephemeral access to media.

## 📡 Real-Time Communication

The backend features a robust WebSocket architecture (`websocket_routes.py`) backed by Redis Pub/Sub. This allows horizontally scaled worker nodes to broadcast events across the entire cluster.
- **Order Updates**: Vendors and Customers subscribe to their respective order channels to receive instant updates when statuses change.
- **Trip Radar**: New orders are broadcasted to all eligible riders in a specific geographic radius.
- **Live Tracking**: Riders stream their GPS coordinates, which are relayed directly to the active customer.

## 🧮 Dispatch & Pricing Engine

The `dispatch_policy.py` controls the economics and logistics of the platform:
- **Retail vs Wholesale**: Different rules for maximum delivery distance, minimum order quantities (MOQ), and vehicle requirements.
- **Dynamic Pricing**: Calculates delivery fees based on Haversine distance, vehicle class, and surge multipliers.
- **Revenue Splitting**: Computes exact payouts for vendors and riders while deducting platform commissions.

## 🛠️ Development Setup

1. **Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
2. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Database**:
   Ensure Docker Compose is running for Postgres + PostGIS and Redis.
4. **Migrations**:
   ```bash
   alembic upgrade head
   ```
5. **Run Server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
6. **Run Background Worker (ARQ)**:
   ```bash
   arq worker.WorkerSettings
   ```
