import logging

logger = logging.getLogger(__name__)

def build_order_snapshot(order, items, vendor, role="rider") -> dict:
    """Build a frozen JSONB payload for notification_model.data"""
    try:
        total_quantity = sum(i.quantity for i in items)
        total_weight_kg = sum(float(i.product.weight_kg or 0) * i.quantity for i in items if i.product)

        snapshot = {
            "order_id": str(order.id),
            "vendor_name": vendor.business_name,
            "vendor_type": vendor.vendor_type.value if hasattr(vendor.vendor_type, 'value') else vendor.vendor_type,
            "total_amount": float(order.total_amount),
            "delivery_fee": float(order.delivery_fee or 0),
            "distance_km": float(order.distance_km) if order.distance_km else None,
            "vehicle_class": order.vehicle_class,
            "delivery_type": order.delivery_type or "quick_swap",
            "total_quantity": total_quantity,
            "total_weight_kg": total_weight_kg,
            "line_items": [
                {
                    "name": item.product.name if item.product else "Unknown Product",
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "subtotal": float(item.Subtotal),
                    "weight_kg": float(item.product.weight_kg) if item.product and item.product.weight_kg else None,
                    "capacity": float(item.product.capacity) if item.product and item.product.capacity else None,
                    "unit": item.product.unit if item.product else "units",
                }
                for item in items
            ],
        }
        
        # Role-based redaction: Riders should not see exact customer phone until accepted in some systems
        # But for operational sanity, we'll give vendors everything.
        if role == "vendor":
            snapshot["customer_phone"] = order.phone
            
        return snapshot
    except Exception as e:
        logger.error(f"Failed to build order snapshot: {e}")
        return {}
