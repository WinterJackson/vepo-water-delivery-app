import { useAuth } from '@clerk/clerk-expo';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { getQueuedActions, removeQueuedAction } from '../config/database';
import { useQueryClient } from '@tanstack/react-query';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

export function useNetworkQueue() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(async (state: any) => {
            if (state.isConnected && state.isInternetReachable) {
                const queued_actions = await getQueuedActions() as any[];
                if (!queued_actions || queued_actions.length === 0) return;

                if (__DEV__) console.log(`Network restored! Flushing ${queued_actions.length} queued action(s)...`);

                const token = await getToken();
                if (!token) return;

                for (let action of queued_actions) {
                    try {
                        const payload = JSON.parse(action.payload);

                        if (action.type === "UPDATE_DELIVERY_STATUS") {
                            const res = await fetch(`${BASE_URL}/api/rider/orders/${action.id}/status`, {
                                method: 'PUT',
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify(payload)
                            });

                            if (res.ok) {
                                await removeQueuedAction(action.id);
                                if (__DEV__) console.log(`Successfully flushed queued action: ${action.id}`);
                                queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
                            } else if (res.status === 400 || res.status === 404 || res.status === 409) {
                                await removeQueuedAction(action.id);
                                if (__DEV__) console.log(`Dropped invalid queued action: ${action.id} due to ${res.status}`);
                            }
                        }
                    } catch (e) {
                        if (__DEV__) console.error('Failed to flush queued action: ', e);
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [getToken]);
}
