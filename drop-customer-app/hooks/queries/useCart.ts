import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCart() {
    const { getToken, userId } = useAuth();
    return useQuery({
        queryKey: ['cart', userId],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return null;
            const res = await fetch(ROUTES.GET_CART, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            return res.json();
        },
        retry: 2
    });
}

export function useDetailedCart() {
    const { getToken, userId } = useAuth();
    return useQuery({
        queryKey: ['cart', 'detailed', userId],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return null;
            const res = await fetch(ROUTES.GET_DETAILED_CART, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            return res.json();
        },
        retry: 2
    });
}

export function useAddToCart() {
    const { getToken, userId } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { id: string; quantity: number; user_id: string; force_replace?: boolean }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.ADD_TO_CART, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.status === 409) {
                const errorData = await res.json();
                const vendorConflict = new Error("vendor_conflict") as any;
                vendorConflict.type = "vendor_conflict";
                vendorConflict.existing_vendor = errorData?.detail?.existing_vendor || "another vendor";
                vendorConflict.existing_vendor_id = errorData?.detail?.existing_vendor_id;
                throw vendorConflict;
            }
            if (!res.ok) throw new Error("Add to cart failed");
            return res.json();
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['cart', userId] });
            await queryClient.cancelQueries({ queryKey: ['cart', 'detailed', userId] });
            const prevCart = queryClient.getQueryData(['cart', userId]);
            const prevDetailed = queryClient.getQueryData(['cart', 'detailed', userId]);
            return { prevCart, prevDetailed };
        },
        onError: (err, payload, context) => {
            if (context?.prevCart) queryClient.setQueryData(['cart', userId], context.prevCart);
            if (context?.prevDetailed) queryClient.setQueryData(['cart', 'detailed', userId], context.prevDetailed);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['cart', userId] });
            queryClient.invalidateQueries({ queryKey: ['cart', 'detailed', userId] });
        }
    });
}

export function useChangeCartQty() {
    const { getToken, userId } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { id: string; quantity: number }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.CHANGE_CART_QTY, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Change qty failed");
            return res.json();
        },
        onMutate: async ({ id, quantity }) => {
            await queryClient.cancelQueries({ queryKey: ['cart', 'detailed', userId] });
            const prevDetailed = queryClient.getQueryData(['cart', 'detailed', userId]);
            queryClient.setQueryData(['cart', 'detailed', userId], (old: any) => {
                if (!old || !old.items) return old;
                return {
                    ...old,
                    items: old.items.map((item: any) => {
                        if (item.id === id) {
                            return { ...item, quantity };
                        }
                        return item;
                    })
                };
            });
            return { prevDetailed };
        },
        onError: (err, payload, context) => {
            if (context?.prevDetailed) queryClient.setQueryData(['cart', 'detailed', userId], context.prevDetailed);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['cart', userId] });
            queryClient.invalidateQueries({ queryKey: ['cart', 'detailed', userId] });
        }
    });
}

export function useDeleteCartItem() {
    const { getToken, userId } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { id: string }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.DELETE_CART_ITEM, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Delete item failed");
            return res.json();
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: ['cart', 'detailed', userId] });
            const prevDetailed = queryClient.getQueryData(['cart', 'detailed', userId]);
            queryClient.setQueryData(['cart', 'detailed', userId], (old: any) => {
                if (!old || !old.items) return old;
                return {
                    ...old,
                    items: old.items.filter((item: any) => item.id !== id)
                };
            });
            return { prevDetailed };
        },
        onError: (err, payload, context) => {
            if (context?.prevDetailed) queryClient.setQueryData(['cart', 'detailed', userId], context.prevDetailed);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['cart', userId] });
            queryClient.invalidateQueries({ queryKey: ['cart', 'detailed', userId] });
        }
    });
}

export function useDeliveryFee(lat_from?: number, lng_from?: number, lat_to?: number, lng_to?: number, vendor_type: string = 'retail_refill', vehicle_class: string = 'motorbike', delivery_type: string = 'quick_swap') {
    return useQuery({
        queryKey: ['delivery-fee', lat_from, lng_from, lat_to, lng_to, vendor_type, vehicle_class, delivery_type],
        queryFn: async () => {
            if (!lat_from || !lng_from || !lat_to || !lng_to) return null;
            const params = new URLSearchParams({
                lat_from: lat_from.toString(),
                lng_from: lng_from.toString(),
                lat_to: lat_to.toString(),
                lng_to: lng_to.toString(),
                vendor_type,
                vehicle_class,
                delivery_type,
            });
            const res = await fetch(`${ROUTES.GET_DELIVERY_FEE}?${params.toString()}`, {
                method: "GET",
            });
            if (!res.ok) throw new Error("Network error fetching delivery fee");
            return res.json();
        },
        enabled: !!lat_from && !!lng_from && !!lat_to && !!lng_to,
        retry: 1
    });
}
