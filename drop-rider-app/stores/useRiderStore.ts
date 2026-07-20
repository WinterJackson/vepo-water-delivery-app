import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import * as Location from "expo-location";
import { Alert } from "react-native";

interface RiderState {
  isOnline: boolean;
  riderId: string | null;
  riderProfile: any | null;
  mutedVendors: string[];
  initAvailability: (token: string) => Promise<void>;
  toggleAvailability: (token: string, value: boolean) => Promise<void>;
  toggleVendorMute: (vendorId: string) => Promise<void>;
}

export const useRiderStore = create<RiderState>((set, get) => ({
  isOnline: false,
  riderId: null,
  riderProfile: null,
  mutedVendors: [],

  initAvailability: async (token: string) => {
    // Check cache first
    const cached = await SecureStore.getItemAsync("rider_availability");
    if (cached !== null) {
      set({ isOnline: cached === "true" });
    }
    
    try {
      const cachedMuted = await SecureStore.getItemAsync("muted_vendors");
      if (cachedMuted) {
        set({ mutedVendors: JSON.parse(cachedMuted) });
      }
    } catch (e) {}

    try {
      const res = await fetch(RiderApiRoutes.GetProfile.path, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        set({ isOnline: data.is_available, riderId: data.id, riderProfile: data });
        await SecureStore.setItemAsync("rider_availability", String(data.is_available));
      }
    } catch (e) {
      if (__DEV__) console.error("Failed to fetch availability", e);
    }
  },

  toggleVendorMute: async (vendorId: string) => {
    const { mutedVendors } = get();
    const isMuted = mutedVendors.includes(vendorId);
    let newMuted = [];
    if (isMuted) {
      newMuted = mutedVendors.filter(id => id !== vendorId);
    } else {
      newMuted = [...mutedVendors, vendorId];
    }
    set({ mutedVendors: newMuted });
    await SecureStore.setItemAsync("muted_vendors", JSON.stringify(newMuted));
  },

  toggleAvailability: async (token: string, value: boolean) => {
    const previousState = get().isOnline;
    
    // Optimistic UI update
    set({ isOnline: value });
    await SecureStore.setItemAsync("rider_availability", String(value));

    try {
      if (value) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          await fetch(RiderApiRoutes.UpdateLocation.path, {
            method: RiderApiRoutes.UpdateLocation.method,
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
          });
        } else {
          Alert.alert("Permission Required", "Location access is required to go online.");
          set({ isOnline: previousState });
          await SecureStore.setItemAsync("rider_availability", String(previousState));
          return;
        }
      }

      const res = await fetch(RiderApiRoutes.ToggleAvailability.path, {
        method: RiderApiRoutes.ToggleAvailability.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: value }),
      });

      if (!res.ok) throw new Error("Failed to update status on server");
    } catch (error) {
      if (__DEV__) console.error("Failed to toggle availability", error);
      // Revert optimism
      set({ isOnline: previousState });
      await SecureStore.setItemAsync("rider_availability", String(previousState));
    }
  }
}));
