import * as Location from "expo-location";
import { create } from "zustand";

interface LocationState {
    location: Location.LocationObject | null;
    address: string | null;
    showPrompt: boolean;
    loading: boolean;
    error: string | null;
    requestLocation: () => Promise<void>;
    reverseGeocode: (lat: number, lng: number) => Promise<string>;
    setAddress: (address: string) => void;
}

/**
 * Formats a reverse-geocode result into a clean, human-readable address string.
 * Never exposes raw lat/lng — always returns a meaningful place name.
 */
function formatAddress(place: Location.LocationGeocodedAddress): string {
    const parts: string[] = [];

    // Prefer name (e.g. "Kenyatta International Convention Centre")
    if (place.name && place.name !== place.street) {
        parts.push(place.name);
    }
    if (place.street) parts.push(place.street);
    if (place.district) parts.push(place.district);
    if (place.city) parts.push(place.city);

    // If we still have nothing, fall back to region/country
    if (parts.length === 0) {
        if (place.region) parts.push(place.region);
        if (place.country) parts.push(place.country);
    }

    return parts.length > 0 ? parts.join(", ") : "Unknown Location";
}

export const useLocation = create<LocationState>((set, get) => ({
    location: null,
    address: null,
    showPrompt: false,
    loading: true,
    error: null,

    setAddress: (address: string) => {
        set({ address });
    },

    reverseGeocode: async (lat: number, lng: number): Promise<string> => {
        try {
            const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (results.length > 0) {
                const addr = formatAddress(results[0]);
                set({ address: addr });
                return addr;
            }
        } catch (error) {
            if (__DEV__) console.warn("Reverse geocode failed:", error);
        }
        const fallback = "Unknown Location";
        set({ address: fallback });
        return fallback;
    },

    requestLocation: async () => {
        set({ loading: true, showPrompt: false, error: null });
        try {
            // 1. Check if location services (GPS) are globally enabled on the device
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                throw new Error("Device location services are turned off.");
            }

            // 2. Request or check app-level permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                // ONLY show the prompt if the app-level permission is explicitly denied
                set({ loading: false, showPrompt: true, error: "Permission denied" });
                return;
            }

            // 3. Try getting last known position first (instant, doesn't require GPS lock)
            let location = await Location.getLastKnownPositionAsync({});
            
            // 4. If no last known position, request current position with a balanced accuracy to prevent timeouts
            if (!location) {
                location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
            }

            if (!location) {
                throw new Error("Unable to determine location.");
            }

            set({ location, showPrompt: false, loading: false, error: null });

            // 5. Auto reverse-geocode after getting coordinates
            const { reverseGeocode } = get();
            await reverseGeocode(location.coords.latitude, location.coords.longitude);
        } catch (error: any) {
            if (__DEV__) console.warn("Location error:", error);
            set({
                loading: false,
                // CRITICAL: Do NOT show the permission prompt for general errors (like GPS timeouts).
                // The prompt should strictly be for App-level permission denial.
                showPrompt: false, 
                error: error?.message || "Failed to get location"
            });
        }
    }
}));
