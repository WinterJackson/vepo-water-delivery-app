import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toast } from '@/lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FavoriteItem {
    id: string;
    product_id: string;
    product?: {
        id: string;
        name: string;
        price: number;
        discount: number;
        image_url: string;
    };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useFavorites() {
    const { getToken } = useAuth();
    return useQuery<FavoriteItem[], Error>({
        queryKey: ['customer', 'favorites'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_FAVORITES, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Favorites fetch failed: ${res.status}`);
            return res.json();
        },
    });
}

export function useAddFavorite() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (productId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.ADD_FAVORITE, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || `Add favorite failed: ${res.status}`);
            }
            return res.json();
        },
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey: ['customer', 'favorites'] });
            const previousFavorites = queryClient.getQueryData(['customer', 'favorites']);
            queryClient.setQueryData(['customer', 'favorites'], (old: any) => {
                const newFavorites = old ? [...old] : [];
                // Add a placeholder item
                newFavorites.push({ id: `temp-${productId}`, product_id: productId });
                return newFavorites;
            });
            return { previousFavorites };
        },
        onError: (err, productId, context) => {
            if (context?.previousFavorites) {
                queryClient.setQueryData(['customer', 'favorites'], context.previousFavorites);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'favorites'] });
        },
        onSuccess: () => {
            Toast.success("Added to Favourites", "Product has been added to your favourites.");
        },
    });
}

export function useRemoveFavorite() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (productId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.REMOVE_FAVORITE, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId }),
            });
            if (!res.ok) throw new Error(`Remove favorite failed: ${res.status}`);
            return res.json();
        },
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey: ['customer', 'favorites'] });
            const previousFavorites = queryClient.getQueryData(['customer', 'favorites']);
            queryClient.setQueryData(['customer', 'favorites'], (old: any) => {
                if (!old) return old;
                return old.filter((fav: any) => fav.product_id !== productId);
            });
            return { previousFavorites };
        },
        onError: (err, productId, context) => {
            if (context?.previousFavorites) {
                queryClient.setQueryData(['customer', 'favorites'], context.previousFavorites);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'favorites'] });
        },
        onSuccess: () => {
            Toast.info("Removed from Favourites", "Product has been removed from your favourites.");
        },
    });
}
