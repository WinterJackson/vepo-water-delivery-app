import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VendorProfile {
    id: string;
    business_name: string;
    location_address?: string;
    lat?: number;
    lng?: number;
    delivery_radius?: number;
    is_online?: boolean;
    profile_pic?: string;
    phone_number?: string;
    vendor_type?: string;
    rating?: number;
    verification_status?: string;
    role?: "owner" | "staff";
    wallet_balance?: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Single source of truth for vendor profile data.
 * Uses cache-busting to prevent stale native networking cache on iOS/Android.
 */
export function useVendorProfile() {
    const { getToken, isLoaded, isSignedIn, signOut } = useAuth();
    return useQuery<VendorProfile, Error>({
        queryKey: ['vendor', 'profile'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token found");
            const res = await fetch(`${VendorApiRoutes.GetProfile.path}?t=${Date.now()}`, {
                method: VendorApiRoutes.GetProfile.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: isLoaded && isSignedIn,
    });
}

/**
 * Mutation to update any vendor profile field (delivery_radius, is_online, etc).
 * Optimistically updates the local cache and reverts on error.
 */
export function useUpdateVendorProfile() {
    const { getToken, signOut } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (updates: Partial<VendorProfile>) => {
            const token = await getToken();
            if (!token) throw new Error("No token found");
            const res = await fetch(VendorApiRoutes.UpdateProfile.path, {
                method: VendorApiRoutes.UpdateProfile.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updates),
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
            return res.json();
        },
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', 'profile'] });
            const previousProfile = queryClient.getQueryData(['vendor', 'profile']);

            // Optimistic update
            queryClient.setQueryData(['vendor', 'profile'], (old: any) => {
                if (!old) return old;
                return { ...old, ...updates };
            });

            return { previousProfile };
        },
        onError: (_err, _updates, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(['vendor', 'profile'], context.previousProfile);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'profile'] });
            queryClient.invalidateQueries({ queryKey: ['vendorDashboard'] });
        },
    });
}

/**
 * Fetch the list of stores for a vendor.
 * Returns an array of VendorProfile objects.
 */
export function useVendorStores() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    return useQuery<VendorProfile[], Error>({
        queryKey: ['vendor', 'stores'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token found");
            const res = await fetch(`${VendorApiRoutes.GetStores.path}?t=${Date.now()}`, {
                method: VendorApiRoutes.GetStores.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
            if (!res.ok) throw new Error(`Stores fetch failed: ${res.status}`);
            return res.json();
        },
    });
}
