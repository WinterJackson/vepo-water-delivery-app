import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RiderApiRoutes from '../../API/routes/RiderApiRoutes';
import { saveOrdersLocal, getOrdersLocal } from '../../config/database';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RiderOrder {
    id: string;
    order_status: string;
    total_amount?: number;
    delivery_address: string;
    customer?: { full_name: string; phone_number: string };
    vendor?: { business_name: string; location_address: string; lat?: number; lng?: number };
    order_item?: { id: string; quantity: number; product?: { name: string } }[];
    rider_net?: number;
    rider_commission?: number;
    payload_surcharge?: number;
    staircase_surcharge?: number;
    vendor_net?: number;
    platform_total?: number;
    distance_km?: number;
    delivery_fee?: number;
    created_at?: string;
}

export interface RiderEarnings {
    total_earned: number;
    total_earnings: number;
    today_earned: number;
    week_earned: number;
    deliveries_count: number;
    total_deliveries: number;
    deliveries_last_7_days?: number;
    rating?: number;
    acceptance_rate?: number;
    is_platinum?: boolean;
    total_staircase_bonus?: number;
    total_payload_bonus?: number;
}

export interface RiderProfile {
    id: string;
    full_name: string;
    name?: string;
    email: string;
    phone_number: string;
    profile_pic?: string;
    is_available: boolean;
    is_platinum?: boolean;
    plate_number?: string;
    vehicle_type?: string;
    rating?: number;
    acceptance_rate?: number;
    zone_changes_this_month?: number;
    last_zone_change?: string;
    operation_lat?: number;
    operation_lng?: number;
    payment_methods?: any[];
    preferences?: any;
    employer_vendor_id?: string;
    kyc_status?: string;
    wallet_balance?: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useRiderOrders() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderOrder[], Error>({
        queryKey: ['rider', 'orders'],
        queryFn: async () => {
            const token = await getToken();
            const route = RiderApiRoutes.GetOrders();
            try {
                const res = await fetch(route.path, {
                    method: route.method,
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });
                if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
                if (!res.ok) {
                    if (res.status === 404) throw new Error("404_NOT_FOUND");
                    throw new Error(`Rider orders fetch failed: ${res.status}`);
                }
                const data = await res.json();
                saveOrdersLocal(data).catch(() => {});
                return data;
            } catch (e: any) {
                if (e.message === "401_UNAUTHORIZED" || e.message === "404_NOT_FOUND") {
                    throw e;
                }
                const localOrders = await getOrdersLocal();
                if (localOrders && localOrders.length > 0) {
                    return localOrders as RiderOrder[];
                }
                throw e;
            }
        },
        staleTime: 1000 * 60,
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND" || (error as Error).message === "401_UNAUTHORIZED") return false;
            return failureCount < 3;
        }
    });
}

export function useRiderEarningsHistory() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderOrder[], Error>({
        queryKey: ['rider', 'orders', 'delivered'],
        queryFn: async () => {
            const token = await getToken();
            const route = RiderApiRoutes.GetOrders("delivered");
            const res = await fetch(route.path, {
                method: route.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Earnings history fetch failed: ${res.status}`);
            }
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // Cache longer since historical data changes rarely
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND" || (error as Error).message === "401_UNAUTHORIZED") return false;
            return failureCount < 3;
        }
    });
}

export function useTripRadar() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderOrder[], Error>({
        queryKey: ['rider', 'trip_radar'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(RiderApiRoutes.TripRadar.path, {
                method: RiderApiRoutes.TripRadar.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Trip radar fetch failed: ${res.status}`);
            }
            return res.json();
        },
        staleTime: 1000 * 5,
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND" || (error as Error).message === "401_UNAUTHORIZED") return false;
            return failureCount < 3;
        }
    });
}

export function useRiderEarnings() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderEarnings, Error>({
        queryKey: ['rider', 'earnings'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(RiderApiRoutes.GetEarnings.path, {
                method: RiderApiRoutes.GetEarnings.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Earnings fetch failed: ${res.status}`);
            }
            return res.json();
        },
        staleTime: 1000 * 30,
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND" || (error as Error).message === "401_UNAUTHORIZED") return false;
            return failureCount < 3;
        }
    });
}

export function useRiderProfile() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderProfile, Error>({
        queryKey: ['rider', 'profile'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(RiderApiRoutes.GetProfile.path, {
                method: RiderApiRoutes.GetProfile.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (res.status === 403) throw new Error("403_FORBIDDEN");
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Profile fetch failed: ${res.status}`);
            }
            return res.json();
        },
        staleTime: 1000 * 60 * 2,
        retry: (failureCount, error) => {
            const msg = (error as Error).message;
            if (msg === "404_NOT_FOUND" || msg === "401_UNAUTHORIZED" || msg === "403_FORBIDDEN") return false;
            return failureCount < 3;
        }
    });
}

export function useAcceptOrder() {
    const { getToken, signOut } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (orderId: string) => {
            const token = await getToken();
            const route = RiderApiRoutes.AcceptDelivery(orderId);
            const res = await fetch(`${route.path}`, {
                method: route.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || "This order was already taken by another rider.");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
            queryClient.invalidateQueries({ queryKey: ['rider', 'trip_radar'] });
        },
        onError: () => {
            // Immediately refresh the radar so the stale/claimed card disappears
            queryClient.invalidateQueries({ queryKey: ['rider', 'trip_radar'] });
        },
    });
}

export interface RiderReview {
    id: string;
    order_id: string;
    rating: number;
    comment: string | null;
    created_at: string | null;
}

export interface RiderReviewsResponse {
    total_reviews: number;
    average_rating: number;
    distribution: {
        [key: string]: number;
    };
    reviews: RiderReview[];
}

export function useRiderReviews() {
    const { getToken, signOut } = useAuth();
    return useQuery<RiderReviewsResponse, Error>({
        queryKey: ['rider', 'reviews'],
        queryFn: async () => {
            const token = await getToken();
            const route = RiderApiRoutes.GetReviews;
            const res = await fetch(route.path, {
                method: route.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (res.status === 401) { await signOut(); throw new Error("401_UNAUTHORIZED"); }
            if (!res.ok) throw new Error(`Rider reviews fetch failed: ${res.status}`);
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error) => {
            if ((error as Error).message === "401_UNAUTHORIZED") return false;
            return failureCount < 3;
        }
    });
}
