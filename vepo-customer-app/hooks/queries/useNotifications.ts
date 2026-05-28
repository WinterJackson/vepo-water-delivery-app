import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    message_type: string;
    related_order_id: string | null;
    is_read: boolean;
    delivered_via: string;
    action_url: string | null;
    created_at: string | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useNotifications() {
    const { getToken } = useAuth();
    return useQuery<NotificationItem[], Error>({
        queryKey: ['customer', 'notifications'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_NOTIFICATIONS, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Notifications fetch failed: ${res.status}`);
            return res.json();
        },
    });
}

export function useMarkNotificationRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.MARK_READ, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notificationId }),
            });
            if (!res.ok) throw new Error(`Mark read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'notifications'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.MARK_ALL_READ, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Mark all read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', 'notifications'] });
        },
    });
}

export function useUnreadNotificationCount() {
    const { getToken } = useAuth();
    return useQuery<{ unread_count: number }, Error>({
        queryKey: ['customer', 'notifications', 'unread-count'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.UNREAD_COUNT, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Unread count failed: ${res.status}`);
            return res.json();
        },
        staleTime: 1000 * 60,
    });
}
