import { ROUTES } from '@/API/routes/ApiRoutes';
import { ApiRoutes } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SavedLocation {
    id: string;
    label: string | null;
    address: string;
    lat: number;
    lng: number;
    is_default: boolean;
    use_count: number;
    last_used_at: string;
}

export interface CreateSavedLocationPayload {
    label?: string;
    address: string;
    lat: number;
    lng: number;
    is_default?: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch all saved locations for the current user */
export function useSavedLocations() {
    const { getToken } = useAuth();
    return useQuery<SavedLocation[], Error>({
        queryKey: ['customer', 'savedLocations'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_SAVED_LOCATIONS, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Saved locations fetch failed: ${res.status}`);
            return res.json();
        },
    });
}

/** Create a new saved location */
export function useCreateSavedLocation() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateSavedLocationPayload) => {
            const token = await getToken();
            const res = await fetch(ROUTES.CREATE_SAVED_LOCATION, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Create location failed: ${res.status}`);
            }
            return res.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'savedLocations'] });
        },
    });
}

/** Delete a saved location */
export function useDeleteSavedLocation() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (locationId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.DELETE_SAVED_LOCATION(locationId), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Delete location failed: ${res.status}`);
            return res.json();
        },
        onMutate: async (locationId) => {
            await queryClient.cancelQueries({ queryKey: ['customer', 'savedLocations'] });
            const prev = queryClient.getQueryData(['customer', 'savedLocations']);
            queryClient.setQueryData(['customer', 'savedLocations'], (old: any) =>
                old ? old.filter((loc: any) => loc.id !== locationId) : old
            );
            return { prev };
        },
        onError: (_err, _id, context) => {
            if (context?.prev) queryClient.setQueryData(['customer', 'savedLocations'], context.prev);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'savedLocations'] });
        },
    });
}

export function useRevokeLocation() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(ApiRoutes.RevokeUserLocation.path, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Revoke location failed: ${res.status}`);
            return res.json();
        },
        onMutate: async () => {
            // Cancel any outgoing user detail refetches
            await queryClient.cancelQueries({ queryKey: ['user', 'details'] });

            // Snapshot for rollback
            const previousUser = queryClient.getQueryData(['user', 'details']);

            // Optimistically clear the user's location
            queryClient.setQueryData(['user', 'details'], (old: import("@/types/models").BasicUser | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    lat: null,
                    lng: null,
                    location_address: null,
                };
            });

            return { previousUser };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user', 'details'], context.previousUser);
            }
        },
        onSettled: () => {
            // Background sync — don't await, let React Query handle it
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
            queryClient.invalidateQueries({ queryKey: ['customer', 'savedLocations'] });
        },
    });
}

/** Select a saved location as the active delivery address.
 *  This syncs lat/lng/address to the User profile on the backend. */
export function useSelectSavedLocation() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (locationId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.USE_SAVED_LOCATION(locationId), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Use location failed: ${res.status}`);
            return res.json();
        },
        onMutate: async (locationId: string) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['user', 'details'] });

            // Snapshot previous user data for rollback
            const previousUser = queryClient.getQueryData(['user', 'details']);

            // Get the saved location we're trying to use
            const savedLocations = queryClient.getQueryData<any[]>(['customer', 'savedLocations']);
            const targetLoc = savedLocations?.find((l) => l.id === locationId);

            // Optimistically update the user details cache with the new location
            if (targetLoc) {
                queryClient.setQueryData(['user', 'details'], (old: import("@/types/models").BasicUser | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        lat: targetLoc.lat,
                        lng: targetLoc.lng,
                        location_address: targetLoc.address,
                    };
                });
            }

            return { previousUser };
        },
        onError: (_err, _locationId, context) => {
            // Roll back to previous user data on error
            if (context?.previousUser) {
                queryClient.setQueryData(['user', 'details'], context.previousUser);
            }
        },
        onSettled: () => {
            // Background sync — don't await, let React Query handle it
            queryClient.invalidateQueries({ queryKey: ['customer', 'savedLocations'] });
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
        },
    });
}
