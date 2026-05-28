import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List, Optional
from core.security import verify_clerk_token
import asyncio
import time

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for live delivery tracking."""

    def __init__(self):
        # rider_id -> WebSocket (rider sending location)
        self.rider_connections: Dict[str, WebSocket] = {}
        # order_id -> list of WebSockets (customers watching)
        self.tracking_connections: Dict[str, List[WebSocket]] = {}  # F-017 FIX
        self.order_rider_map: Dict[str, str] = {}
        # rider_id -> latest location
        self.rider_locations: Dict[str, dict] = {}
        
        # Entity Order Connections (Real-Time State Tracking)
        self.vendor_orders: Dict[str, List[WebSocket]] = {}
        self.customer_orders: Dict[str, List[WebSocket]] = {}
        self.rider_orders: Dict[str, List[WebSocket]] = {}

    async def connect_entity(self, entity_type: str, entity_id: str, websocket: WebSocket):
        await websocket.accept()
        target_dict = getattr(self, f"{entity_type}_orders", None)
        if target_dict is not None:
            if entity_id not in target_dict:
                target_dict[entity_id] = []
            target_dict[entity_id].append(websocket)
            logger.info(f"{entity_type.capitalize()} {entity_id} connected for order updates.")

    def disconnect_entity(self, entity_type: str, entity_id: str, websocket: WebSocket):
        target_dict = getattr(self, f"{entity_type}_orders", None)
        if target_dict is not None and entity_id in target_dict:
            try:
                target_dict[entity_id].remove(websocket)
                if not target_dict[entity_id]:
                    del target_dict[entity_id]
            except ValueError:
                pass

    async def broadcast_order_update(self, vendor_id: str, customer_id: str, deliverer_id: str, payload: dict):
        mapping = {
            "vendor": vendor_id,
            "customer": customer_id,
            "rider": deliverer_id
        }
        for entity_type, entity_id in mapping.items():
            if not entity_id:
                continue
            target_dict = getattr(self, f"{entity_type}_orders", None)
            if target_dict and str(entity_id) in target_dict:
                for ws in target_dict[str(entity_id)]:
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        logger.error(f"Failed broadcasting WS to {entity_type} {entity_id}")

    async def broadcast_to_riders(self, rider_ids: List[str], payload: dict):
        """Send a payload directly to a specific list of riders. Used for Trip Radar and Tier 1 dispatch."""
        for r_id in rider_ids:
            if str(r_id) in self.rider_orders:
                for ws in self.rider_orders[str(r_id)]:
                    try:
                        await ws.send_json(payload)
                    except Exception as e:
                        logger.error(f"Failed broadcasting WS to specific rider {r_id}: {e}")


    async def connect_rider(self, rider_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rider_connections[rider_id] = websocket
        logger.info(f"Rider {rider_id} connected via WebSocket")

    def disconnect_rider(self, rider_id: str):
        self.rider_connections.pop(rider_id, None)
        self.rider_locations.pop(rider_id, None)
        logger.info(f"Rider {rider_id} disconnected")

    async def connect_tracker(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.tracking_connections:
            self.tracking_connections[order_id] = []
        self.tracking_connections[order_id].append(websocket)
        logger.info(f"Tracker connected for order {order_id}")

    def disconnect_tracker(self, order_id: str, websocket: WebSocket):
        if order_id in self.tracking_connections:
            self.tracking_connections[order_id].remove(websocket)
            if not self.tracking_connections[order_id]:
                del self.tracking_connections[order_id]

    async def update_rider_location(self, rider_id: str, location: dict):
        self.rider_locations[rider_id] = location
        # Broadcast to all customers tracking orders assigned to this rider
        for order_id, mapped_rider in self.order_rider_map.items():
            if mapped_rider == rider_id and order_id in self.tracking_connections:
                for ws in self.tracking_connections[order_id]:
                    try:
                        await ws.send_json({"rider_id": rider_id, "location": location})
                    except Exception:
                        pass

    def map_order_to_rider(self, order_id: str, rider_id: str):
        self.order_rider_map[order_id] = rider_id


manager = ConnectionManager()


# ── F-003 FIX: WebSocket JWT Authentication Helper ────────────────────────
async def _authenticate_ws(websocket: WebSocket, token: Optional[str]) -> Optional[dict]:
    """Verify JWT token for WebSocket connections. Returns payload or None."""
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return None
    try:
        payload = await verify_clerk_token(token)
        if not payload:
            await websocket.close(code=1008, reason="Invalid or expired token")
            return None
        return payload
    except Exception:
        await websocket.close(code=1008, reason="Authentication failed")
        return None


@router.websocket("/ws/rider/{rider_id}")
async def rider_location_ws(websocket: WebSocket, rider_id: str, token: Optional[str] = Query(None)):
    """Rider sends periodic location updates as JSON: {"lat": ..., "lng": ...}"""
    user = await _authenticate_ws(websocket, token)
    if not user:
        return
    await manager.connect_rider(rider_id, websocket)
    try:
        while True:
            try:
                # BUG-WS-01 FIX: Server-side heartbeat to prevent silent proxy timeouts
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                await manager.update_rider_location(rider_id, data)
                
                # Persist location to database asynchronously for tracking accuracy
                try:
                    from dependencies.dependencies import get_db_session
                    from services.deliverer_service import update_deliverer_location_by_id
                    async with get_db_session() as session:
                        await update_deliverer_location_by_id(
                            session=session,
                            deliverer_id=rider_id,
                            lat=data.get("lat", 0.0),
                            lng=data.get("lng", 0.0),
                        )
                except Exception as e:
                    logger.warning(f"WS location DB persist failed for rider {rider_id}: {e}")
            except asyncio.TimeoutError:
                await websocket.send_json({"action": "heartbeat", "timestamp": time.time()})
    except WebSocketDisconnect:
        manager.disconnect_rider(rider_id)


@router.websocket("/ws/track/{order_id}")
async def track_order_ws(websocket: WebSocket, order_id: str, token: Optional[str] = Query(None)):
    """Customer connects to receive live rider location updates for their order."""
    user = await _authenticate_ws(websocket, token)
    if not user:
        return
    await manager.connect_tracker(order_id, websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"action": "heartbeat", "timestamp": time.time()})
    except WebSocketDisconnect:
        manager.disconnect_tracker(order_id, websocket)


@router.websocket("/ws/orders/{entity_type}/{entity_id}")
async def orders_ws(websocket: WebSocket, entity_type: str, entity_id: str, token: Optional[str] = Query(None)):
    """Generic endpoint for vendors, customers, or riders to listen for real-time order status updates."""
    user = await _authenticate_ws(websocket, token)
    if not user:
        return
    if entity_type not in ["vendor", "customer", "rider"]:
        await websocket.close()
        return
        
    await manager.connect_entity(entity_type, entity_id, websocket)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    message = json.loads(data)
                    if message.get("action") == "join-entity-room":
                        pass
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                await websocket.send_json({"action": "heartbeat", "timestamp": time.time()})
    except WebSocketDisconnect:
        manager.disconnect_entity(entity_type, entity_id, websocket)
