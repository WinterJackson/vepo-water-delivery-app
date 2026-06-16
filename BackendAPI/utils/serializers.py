"""
Utility to safely serialize SQLAlchemy ORM objects into JSON-safe dicts.
Handles PostGIS Geography/WKB binary fields, UUIDs, datetimes, and Python Enums.
"""
from geoalchemy2.elements import WKBElement, WKTElement


# All types that represent spatial/binary data and must be skipped during serialization
_SKIP_TYPES = (bytes, memoryview, WKBElement, WKTElement)


def safe_serialize(obj) -> dict:
    """Convert an ORM object to a JSON-safe dict, skipping binary/Geography fields.
    
    GeoAlchemy2 stores location columns as WKBElement objects (not raw bytes).
    FastAPI's jsonable_encoder walks into WKBElement, finds its .data (bytes),
    and crashes calling bytes.decode() on non-UTF-8 WKB binary data.
    """
    result = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name, None)
        # Skip spatial/binary types and highly sensitive encrypted PII
        if isinstance(val, _SKIP_TYPES) or col.name in ("ID_number", "account_details"):
            continue
        if val is None:
            result[col.name] = None
            continue
        if hasattr(val, 'isoformat'):
            val = val.isoformat()
        elif hasattr(val, 'hex') and not isinstance(val, str):  # UUID
            val = str(val)
        elif hasattr(val, 'value') and hasattr(val, 'name') and not isinstance(val, str):  # Enum
            val = val.value
        result[col.name] = val
    return result
