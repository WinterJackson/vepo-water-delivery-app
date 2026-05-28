import VendorApiRoutes from '@/API/routes/VendorApiRoutes';
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
        queryKey: ['vendor', 'notifications'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${VendorApiRoutes.GetNotifications.path}&t=${Date.now()}`, {
                method: VendorApiRoutes.GetNotifications.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            });
            if (!res.ok) throw new Error(`Notifications fetch failed: ${res.status}`);
            return res.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useMarkNotificationRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const token = await getToken();
            const res = await fetch(VendorApiRoutes.MarkNotificationRead.path, {
                method: VendorApiRoutes.MarkNotificationRead.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notificationId }),
            });
            if (!res.ok) throw new Error(`Mark read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'notifications'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(VendorApiRoutes.MarkAllNotificationsRead.path, {
                method: VendorApiRoutes.MarkAllNotificationsRead.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Mark all read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'notifications'] });
        },
    });
}

export function useUnreadNotificationCount() {
    const { getToken } = useAuth();
    return useQuery<{ unread_count: number }, Error>({
        queryKey: ['vendor', 'notifications', 'unread-count'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${VendorApiRoutes.GetUnreadNotificationCount.path}&t=${Date.now()}`, {
                method: VendorApiRoutes.GetUnreadNotificationCount.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            });
            if (!res.ok) throw new Error(`Unread count fetch failed: ${res.status}`);
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useDeleteNotification() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const token = await getToken();
            const route = VendorApiRoutes.DeleteNotification(notificationId);
            const res = await fetch(route.path, {
                method: route.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', 'notifications'] });
            queryClient.invalidateQueries({ queryKey: ['vendor', 'notifications', 'unread-count'] });
        },
    });
}
