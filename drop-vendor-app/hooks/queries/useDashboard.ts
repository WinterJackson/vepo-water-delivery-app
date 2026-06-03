import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";

export function useDashboard() {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ["vendorDashboard"],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token found");

            const response = await fetch(`${VendorApiRoutes.GetDashboard.path}?t=${Date.now()}`, {
                method: VendorApiRoutes.GetDashboard.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch dashboard");
            }

            const data = await response.json();
            return data;
        },
    });
}
