import RiderApiRoutes from '@/API/routes/RiderApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

/**
 * Hook to reject an assigned delivery order.
 * Triggers backend reassignment engine and invalidates local order cache.
 */
export function useRejectDelivery() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: string) => {
            const token = await getToken();
            const route = RiderApiRoutes.RejectDelivery(orderId);
            const res = await fetch(route.path, {
                method: route.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || `Reject failed: ${res.status}`);
            }
            return res.json();
        },
        onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
            queryClient.invalidateQueries({ queryKey: ['rider', 'notifications'] });
        },
        onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
    });
}
