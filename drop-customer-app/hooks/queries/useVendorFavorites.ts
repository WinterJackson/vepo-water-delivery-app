import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toast } from '@/lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VendorFavoriteItem {
    id: string;
    vendor_id: string;
    vendor?: {
        id: string;
        business_name: string;
        profile_pic: string;
        rating: number;
        location_address: string;
    };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch all vendor favourites for the current user */
export function useVendorFavorites() {
    const { getToken } = useAuth();
    return useQuery<VendorFavoriteItem[], Error>({
        queryKey: ['vendor', 'favorites'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_VENDOR_FAVORITES, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Vendor favorites fetch failed: ${res.status}`);
            return res.json();
        },
    });
}

/** Add a vendor to favourites */
export function useAddVendorFavorite() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (vendorId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.ADD_VENDOR_FAVORITE, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_id: vendorId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || `Add vendor favorite failed: ${res.status}`);
            }
            return res.json();
        },
        onMutate: async (vendorId) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', 'favorites'] });
            const previous = queryClient.getQueryData(['vendor', 'favorites']);
            queryClient.setQueryData(['vendor', 'favorites'], (old: any) => {
                const arr = old ? [...old] : [];
                arr.push({ id: `temp-${vendorId}`, vendor_id: vendorId });
                return arr;
            });
            return { previous };
        },
        onError: (_err, _vendorId, context) => {
            if (context?.previous) queryClient.setQueryData(['vendor', 'favorites'], context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'favorites'] });
        },
        onSuccess: () => {
            Toast.success("Added to Favourites", "Vendor has been added to your favourites.");
        },
    });
}

/** Remove a vendor from favourites */
export function useRemoveVendorFavorite() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (vendorId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.REMOVE_VENDOR_FAVORITE, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_id: vendorId }),
            });
            if (!res.ok) throw new Error(`Remove vendor favorite failed: ${res.status}`);
            return res.json();
        },
        onMutate: async (vendorId) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', 'favorites'] });
            const previous = queryClient.getQueryData(['vendor', 'favorites']);
            queryClient.setQueryData(['vendor', 'favorites'], (old: any) => {
                if (!old) return old;
                return old.filter((fav: any) => fav.vendor_id !== vendorId);
            });
            return { previous };
        },
        onError: (_err, _vendorId, context) => {
            if (context?.previous) queryClient.setQueryData(['vendor', 'favorites'], context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'favorites'] });
        },
        onSuccess: () => {
            Toast.info("Removed from Favourites", "Vendor has been removed from your favourites.");
        },
    });
}

/** Check if a specific vendor is favourited */
export function useCheckVendorFavorite(vendorId: string) {
    const { getToken } = useAuth();
    return useQuery<{ is_favorite: boolean }, Error>({
        queryKey: ['vendor', 'favorites', 'check', vendorId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.CHECK_VENDOR_FAVORITE(vendorId), {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Check vendor favorite failed: ${res.status}`);
            return res.json();
        },
        enabled: !!vendorId,
    });
}

/** Fetch the last order from a specific vendor */
export function useLastOrderFromVendor(vendorId: string) {
    const { getToken } = useAuth();
    return useQuery<any, Error>({
        queryKey: ['vendor', 'lastOrder', vendorId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.LAST_ORDER_FROM_VENDOR(vendorId), {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Last order fetch failed: ${res.status}`);
            const json = await res.json();
            return json.order; // can be null
        },
        enabled: !!vendorId,
    });
}
