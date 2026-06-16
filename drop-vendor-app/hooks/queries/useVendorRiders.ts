import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";

export interface VendorRider {
  deliverer_id: string;
  name?: string;
  phone_number?: string;
  vehicle_type?: string;
  status: string;
  // include other fields as necessary
}

export function useVendorRiders() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  
  return useQuery<VendorRider[], Error>({
    queryKey: ['vendor', 'riders'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No token found");

      const res = await fetch(`${VendorApiRoutes.GetMyRiders.path}?t=${Date.now()}`, {
        method: VendorApiRoutes.GetMyRiders.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!res.ok) {
        throw new Error(`Riders fetch failed: ${res.status}`);
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isLoaded && isSignedIn,
    refetchInterval: 30000,
  });
}
