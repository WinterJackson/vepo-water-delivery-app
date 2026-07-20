import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ContactInfo {
    role: "customer" | "vendor" | "rider";
    name: string;
    phone: string;
    vehicle_details?: string;
    profile_pic?: string;
}

export interface OrderContactsResponse {
    contacts: ContactInfo[];
}

// Active states where contacts are available
const CONTACT_VISIBLE_STATES = ["pending", "accepted", "assigned", "preparing", "ready", "picked_up", "mismatch_pending", "pending_review"];

// ─── Fetch Function ───────────────────────────────────────────────────────────
async function fetchOrderContacts(orderId: string, token: string | null): Promise<OrderContactsResponse> {
    const res = await fetch(`${BASE_URL}/api/contacts/${orderId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        if (res.status === 403) return { contacts: [] };
        throw new Error(`Contacts fetch failed: ${res.status}`);
    }
    return res.json();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOrderContacts(orderId: string | null, orderStatus: string | null) {
    const { getToken } = useAuth();
    const isActive = orderStatus ? CONTACT_VISIBLE_STATES.includes(orderStatus) : false;

    return useQuery<OrderContactsResponse, Error>({
        queryKey: ['orderContacts', orderId],
        queryFn: async () => {
            const token = await getToken();
            return fetchOrderContacts(orderId!, token);
        },
        enabled: !!orderId && isActive,
        staleTime: 1000 * 60 * 2,
        retry: 1,
    });
}
