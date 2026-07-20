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
    payment_method: string;
    payment_status?: string;
    delivery_address?: string;
    delivery_time?: number;
    delivery_type?: string;
    bottle_source?: string;
    customer_note?: string;
    payload_surcharge?: number;
    staircase_surcharge?: number;
    is_locked: boolean;
    is_rated?: boolean;
    lat?: number;
    lng?: number;
    lat_from?: number;
    lng_from?: number;
    product_subtotal?: number;
    wallet_discount?: number;
    welcome_discount?: number;
    service_fee?: number;
    surge_fee?: number;
    vendor?: { id: string; business_name: string; location_address: string; profile_pic?: string; phone_number?: string; vendor_type?: string; lat?: number; lng?: number };
    deliverer?: { id: string; full_name: string; phone_number?: string; vehicle_details?: string };
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

async function resolveMismatchFetch(orderId: string, action: string, token: string | null): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}/resolve-mismatch`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error(`Resolve mismatch failed: ${res.status}`);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useOrders() {
    const { getToken, userId } = useAuth();
    return useQuery<Order[], Error>({
        queryKey: ['customer', 'orders', userId],
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

export function useResolveMismatch() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ orderId, action }: { orderId: string; action: string }) => {
            const token = await getToken();
            return resolveMismatchFetch(orderId, action, token);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] });
            queryClient.invalidateQueries({ queryKey: ['customer', 'orders', 'active'] });
        },
    });
}

export function usePaymentHistory() {
    const { getToken, userId } = useAuth();
    return useQuery<any[], Error>({
        queryKey: ['customer', 'payments', userId],
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
    const { getToken, userId } = useAuth();
    return useQuery<Order | null, Error>({
        queryKey: ['customer', 'orders', 'last-completed', userId],
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

export function useActiveOrder() {
    const { getToken, userId } = useAuth();
    return useQuery<Order | null, Error>({
        queryKey: ['customer', 'orders', 'active', userId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/cart/orders/active`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Active order fetch failed: ${res.status}`);
            const data = await res.json();
            return data;
        },
        staleTime: 60000,
    });
}

export function useOrderTrackingLogs(orderId: string | null) {
    const { getToken, userId } = useAuth();
    return useQuery<any[], Error>({
        queryKey: ['customer', 'orders', orderId, 'tracking', userId],
        queryFn: async () => {
            if (!orderId) return [];
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/cart/orders/${orderId}/tracking-logs`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Tracking logs fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!orderId,
    });
}
