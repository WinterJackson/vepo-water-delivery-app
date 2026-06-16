from dataclasses import dataclass
from fastapi import HTTPException

@dataclass
class DispatchPolicy:
    RETAIL_MAX_DISTANCE_KM: float = 2.0
    WHOLESALE_MAX_DISTANCE_KM: float = 15.0  # Upgraded to 15km for city-wide logistics
    RETAIL_RIDER_REGISTRATION_MAX_RADIUS_KM: float = 2.0
    WHOLESALE_RIDER_REGISTRATION_MAX_RADIUS_KM: float = 15.0
    WHOLESALE_MOQ_KG: float = 100.0  # Mandatory 100kg+ MOQ

    # Pricing & Capacity Engine
    RETAIL_FLAT_FEE_KSH: float = 50.0  # Strict flat rate
    VEHICLE_PRICING = {
        "motorbike": {"base": 50.0, "per_km": 60.0},
        "tuktuk":    {"base": 150.0, "per_km": 100.0},
        "truck":     {"base": 500.0, "per_km": 150.0},
    }
    
    # Per-vehicle capacity limits (quantities are conceptually "items/bottles")
    VEHICLE_CAPACITIES = {
        "motorbike": 4,   # Max 4 bottles
        "tuktuk": 20,     # Max 20 bottles
        "truck": 200      # Max 200 bottles (preventing abuse while allowing wholesale)
    }

    @classmethod
    def get_vehicle_class(cls, total_quantity: int) -> str:
        """Determines the required vehicle class based on quantity payload."""
        if total_quantity <= cls.VEHICLE_CAPACITIES["motorbike"]:
            return "motorbike"
        elif total_quantity <= cls.VEHICLE_CAPACITIES["tuktuk"]:
            return "tuktuk"
        elif total_quantity <= cls.VEHICLE_CAPACITIES["truck"]:
            return "truck"
        else:
            raise ValueError(f"Payload capacity exceeded. Maximum {cls.VEHICLE_CAPACITIES['truck']} items per trip.")

    @classmethod
    def get_max_distance_m(cls, vendor_type: str, action: str = "delivery") -> float:
        """
        Returns max distance in meters for ST_DWithin constraints.
        action can be "delivery" or "rider_search".
        """
        if action == "rider_search":
            return (cls.WHOLESALE_MAX_DISTANCE_KM if vendor_type == "wholesale_b2b" else cls.RETAIL_MAX_DISTANCE_KM) * 1000.0
        
        # Action is "delivery" (checkout restriction)
        if vendor_type == "retail_refill":
            return cls.RETAIL_MAX_DISTANCE_KM * 1000.0
        else:
            # For wholesale deliveries, we don't strictly cap the delivery distance, 
            # but we can return the global 10km search radius as a soft-cap or None
            return None

    @classmethod
    def get_h3_k_ring(cls, vendor_type: str) -> int:
        """
        Derives grid search ring radius based on business model.
        Res 8 base cell edge length is ~461m.
        """
        if vendor_type == "wholesale_b2b":
             # WHOLESALE: Need up to 10km radius. 10,000 / 461 ≈ 21.6. So k=22 rings.
             return 22
        # RETAIL: Max 2km limit. 2000 / 461 ≈ 4.3. So k=5 rings.
        return 5

    @classmethod
    def validate_cart_preflight(cls, vendor_type: str, distance_km: float, total_quantity: int, total_weight_kg: float = 0.0, is_wholesale_capable: bool = False):
        """
        Enforce distance and payload restrictions prior to checkout processing.
        """
        # 1. Capacity Rules
        try:
            cls.get_vehicle_class(total_quantity)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 2. Wholesale Business Rules
        if vendor_type == "wholesale_b2b":
            if total_weight_kg < cls.WHOLESALE_MOQ_KG:
                raise HTTPException(status_code=400, detail=f"Wholesale requires a minimum payload of {cls.WHOLESALE_MOQ_KG}kg. Current payload: {total_weight_kg}kg. Please add more items.")
            pass

        # 3. Retail Rules
        if vendor_type == "retail_refill":
            if distance_km > cls.RETAIL_MAX_DISTANCE_KM:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Distance {distance_km:.1f}km exceeds the single-trip retail limit of {cls.RETAIL_MAX_DISTANCE_KM}km. Please select a closer vendor."
                )
            if total_quantity > 4:
                raise HTTPException(
                    status_code=400,
                    detail=f"Retail orders are fulfilled via motorbikes which can carry a maximum of 4 (20L) bottles per trip. You requested {total_quantity}."
                )

    @classmethod
    def should_auto_dispatch(cls, vendor_type: str) -> bool:
        """
        Determines whether the system should immediately trigger the automated dispatch engine.
        Now enabled for both Retail and Wholesale to handle Tier 1 (In-House) -> Tier 2 (Trip Radar) switch.
        """
        return True

    @classmethod
    def get_delivery_fee(cls, distance_km: float, vendor_type: str, vehicle_class: str, wholesale_base: float = 0.0, wholesale_per_km: float = 0.0, delivery_type: str = "quick_swap") -> float:
        """Returns the calculated delivery fee based on vendor type and vehicle."""
        if vendor_type == "wholesale_b2b":
            # Wholesale custom pricing takes precedence
            if wholesale_base > 0 or wholesale_per_km > 0:
                fee = wholesale_base + (wholesale_per_km * distance_km)
                return round(fee, 2)
                
            # Fallback to defaults
            pricing = cls.VEHICLE_PRICING.get(vehicle_class, cls.VEHICLE_PRICING["tuktuk"])
            fee = pricing["base"] + (pricing["per_km"] * distance_km)
            return round(fee, 2)
        else:
            # Retail pricing
            if delivery_type == "keep_my_bottle":
                return round(50.0 + (25.0 * distance_km), 2)
            else:
                return round(30.0 + (15.0 * distance_km), 2)
