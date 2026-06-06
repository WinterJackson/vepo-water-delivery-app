import RiderApiRoutes from '@/API/routes/RiderApiRoutes';
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
        queryKey: ['rider', 'notifications'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${RiderApiRoutes.GetNotifications.path}&t=${Date.now()}`, {
                method: RiderApiRoutes.GetNotifications.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            });
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Notifications fetch failed: ${res.status}`);
            }
            return res.json();
        },
        refetchInterval: 30000, // Poll every 30 seconds for new notifications
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND") return false;
            return failureCount < 3;
        }
    });
}

export function useMarkNotificationRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const token = await getToken();
            const res = await fetch(RiderApiRoutes.MarkNotificationRead.path, {
                method: RiderApiRoutes.MarkNotificationRead.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notificationId }),
            });
            if (!res.ok) throw new Error(`Mark read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rider', 'notifications'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(RiderApiRoutes.MarkAllNotificationsRead.path, {
                method: RiderApiRoutes.MarkAllNotificationsRead.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Mark all read failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rider', 'notifications'] });
        },
    });
}

export function useUnreadNotificationCount() {
    const { getToken } = useAuth();
    return useQuery<{ unread_count: number }, Error>({
        queryKey: ['rider', 'notifications', 'unread-count'],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${RiderApiRoutes.GetUnreadNotificationCount.path}&t=${Date.now()}`, {
                method: RiderApiRoutes.GetUnreadNotificationCount.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            });
            if (!res.ok) {
                if (res.status === 404) throw new Error("404_NOT_FOUND");
                throw new Error(`Unread count fetch failed: ${res.status}`);
            }
            return res.json();
        },
        refetchInterval: 30000,
        retry: (failureCount, error) => {
            if ((error as Error).message === "404_NOT_FOUND") return false;
            return failureCount < 3;
        }
    });
}

export function useDeleteNotification() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const token = await getToken();
            const route = RiderApiRoutes.DeleteNotification(notificationId);
            const res = await fetch(route.path, {
                method: route.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rider', 'notifications'] });
            queryClient.invalidateQueries({ queryKey: ['rider', 'notifications', 'unread-count'] });
        },
    });
}
