import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Order {
    id: string;
    order_status: string;
    total_amount: number;
    delivery_fee?: number;
    vehicle_class?: string;
    created_at: string;
    is_rated?: boolean;
    vendor?: { id: string; business_name: string; location_address: string; profile_pic?: string; phone_number?: string; vendor_type?: string };
    deliverer?: { id: string; full_name: string; phone_number?: string };
    order_item?: OrderItem[];
}

export interface OrderItem {
    id: string;
    quantity: number;
    price: number;
    product?: { name: string; image_url: string };
}

// ─── Fetch Functions ──────────────────────────────────────────────────────────
async function fetchOrders(token: string | null): Promise<Order[]> {
    const res = await fetch(ROUTES.GET_ORDERS, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`);
    return res.json();
}

async function cancelOrderFetch(orderId: string, token: string | null): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Cancel order failed: ${res.status}`);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useOrders() {
    const { getToken } = useAuth();
    return useQuery<Order[], Error>({
        queryKey: ['customer', 'orders'],
        queryFn: async () => {
            const token = await getToken();
            return fetchOrders(token);
        },
        staleTime: 1000 * 60 * 5, // 5 min — matches global default; WebSocket handles real-time
        // FIX-CONTINUOUS-FETCH-01: Multiple screens (Orders, OrderDetail, Map) keep this query
        // mounted simultaneously in the Stack. Without this, every screen mount/focus triggers
        // a fresh GET /api/cart/get_orders even though the data is already cached.
        refetchOnMount: false,
    });
}

export function useCancelOrder() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (orderId: string) => {
            const token = await getToken();
            return cancelOrderFetch(orderId, token);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] });
        },
    });
}

export function usePaymentHistory() {
    const { getToken } = useAuth();
    return useQuery<any[], Error>({
        queryKey: ['customer', 'payments'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_PAYMENT_HISTORY, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
            });
            if (!res.ok) throw new Error("Failed to fetch payment history");
            return res.json();
        },
    });
}

export function useLastCompletedOrder() {
    const { getToken } = useAuth();
    return useQuery<Order | null, Error>({
        queryKey: ['customer', 'orders', 'last-completed'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/cart/orders/last-completed`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Last order fetch failed: ${res.status}`);
            const data = await res.json();
            return data;
        },
        staleTime: 60000,
    });
}
