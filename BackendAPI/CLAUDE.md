# Drop Backend API - AI Developer Guide

## 🎯 Architecture & Business Workflow
The Backend API is the central nervous system for the Drop platform. It enforces business rules, manages state transitions, and brokers communication between Customers, Vendors, and Riders.

Key Business Workflows:
1. **Order State Machine**: Handled primarily in `order_service.py`. The strict transition is: `pending` → `unassigned` (paid) → `accepted` → `preparing` → `ready` → `picked_up` → `delivered`.
   - **Deviations**: `pending_review` (if rider flags a bottle mismatch), `mismatch_pending` (vendor flags a quantity issue).
2. **Dispatch & Trip Radar**: 
   - `unassigned` orders trigger a search for riders.
   - If an `in_house` rider belonging to the vendor is available, they are assigned first.
   - Otherwise, a spatial query (PostGIS `ST_DWithin`) finds nearby gig riders and broadcasts the order via WebSockets (`broadcast_to_riders`).
3. **Reconciliation & Payouts**: 
   - When an order reaches `delivered`, `update_delivery_status` triggers `calculate_revenue_splits`. 
   - Atomic transactions create `WalletTransaction` entries for both the Rider and the Vendor, deducting the platform's cut.
4. **S3 & KYC**: 
   - Direct image URLs are NEVER stored in the database. 
   - The database stores S3 keys. 
   - Pydantic models (e.g. `DelivererResponse`, `OrderResponse`) use `@field_validator(mode='after')` to intercept these keys and inject 15-minute expiring presigned S3 URLs before returning JSON to the client.

## 🏗️ Technical Stack
- **Framework**: FastAPI (async).
- **ORM**: SQLAlchemy 2.0 (asyncio).
- **Schema Validation**: Pydantic v2.
- **Background Tasks**: ARQ (Async Redis Queue).

## 📜 Coding Guidelines

### 1. Database Interactions
- Use asynchronous SQLAlchemy sessions (`AsyncSession`).
- **Idempotency & Concurrency**: For critical operations like Accepting an Order (`AcceptDelivery`) or Wallet updates, use `select(...).with_for_update()` to lock the row and prevent race conditions.
- Always use `func.now()` for `updated_at` columns, never `datetime.now()` in the application layer, to ensure the DB handles timestamp consistency.

### 2. API Routing
- Group endpoints logically in `routes/`.
- Use the standard `get_db_session` dependency.
- Use `get_current_user` or entity-specific authenticators (`get_current_vendor`, `get_current_deliverer`) to enforce RBAC.

### 3. Pydantic Models
- Base models and DB schemas live in `schemas/`.
- Ensure strict type separation between internal DB representation and external API responses (e.g., `OrderCreate`, `OrderUpdate`, `OrderResponse`).
- Do not expose sensitive data (like plain text passwords or internal S3 keys). Use field validators for transformation.

### 4. Background Tasks
- Long-running or non-critical tasks (like sending Push Notifications or resolving timed-out bottle disputes) must be offloaded to ARQ in `worker.py`. 
- Do not block the main FastAPI event loop.

### 5. Error Handling
- Raise `HTTPException` with clear, actionable `detail` messages.
- For business logic violations (e.g., trying to accept an already-accepted order), return 409 Conflict.
- For unauthorized access, return 401 or 403.
