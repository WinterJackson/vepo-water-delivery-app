import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RiderLocation {
    rider_id: string;
    rider_name: string;
    lat: number | null;
    lng: number | null;
    is_available: boolean;
}

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';

/**
 * WebSocket-first rider tracking with REST polling fallback.
 * 
 * Strategy:
 * 1. Opens a WebSocket to `/ws/track/{orderId}` for real-time GPS.
 * 2. Falls back to REST polling if WS fails to connect after 3 attempts.
 * 3. Follows drop-realtime-patterns: WS events invalidate React Query cache.
 * 4. Properly cleans up on unmount per react-native-best-practices.
 * 
 * @param orderId - The order to track
 * @param enabled - Only track when order is in active transit
 * @param pollingIntervalMs - REST fallback interval (default 8s)
 */
export function useRiderTracking(orderId: string | null, enabled = true, pollingIntervalMs = 8000) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const [data, setData] = useState<RiderLocation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wsFailCountRef = useRef(0);
    const isMountedRef = useRef(true);
    const MAX_WS_FAILURES = 3;

    // ── REST Polling Fallback ──────────────────────────────────────────────
    const fetchViaRest = useCallback(async () => {
        if (!orderId) return;
        try {
            const token = await getToken();
            const res = await fetch(ROUTES.RIDER_LOCATION(orderId), {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok) throw new Error(`Tracking fetch failed: ${res.status}`);
            const location = await res.json();
            if (isMountedRef.current) {
                setData(location);
                setIsLoading(false);
                setError(null);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err : new Error('Tracking failed'));
                setIsLoading(false);
            }
        }
    }, [orderId, getToken]);

    const startPolling = useCallback(() => {
        // Immediate first fetch
        fetchViaRest();
        // Schedule interval
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(fetchViaRest, pollingIntervalMs);
    }, [fetchViaRest, pollingIntervalMs]);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    // ── WebSocket Connection ──────────────────────────────────────────────
    const connectWs = useCallback(async () => {
        if (!orderId || !enabled) return;
        
        try {
            const token = await getToken();
            const wsBaseUrl = BASE_URL.replace('http', 'ws');
            const wsUrl = `${wsBaseUrl}/ws/track/${orderId}?token=${token}`;

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (__DEV__) console.log(`[WS Tracker] Connected for order ${orderId}`);
                wsFailCountRef.current = 0;
                // Stop polling once WS is live
                stopPolling();
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    const location = payload.location || payload;
                    if (isMountedRef.current && location.lat != null && location.lng != null) {
                        setData(prev => ({
                            rider_id: location.rider_id || payload.rider_id || prev?.rider_id || '',
                            rider_name: location.rider_name || prev?.rider_name || 'Rider',
                            lat: location.lat,
                            lng: location.lng,
                            is_available: true,
                        }));
                        setIsLoading(false);
                        setError(null);
                        // Drop realtime pattern: invalidate cache so other components see fresh data
                        queryClient.invalidateQueries({ queryKey: ['customer', 'rider-location', orderId] });
                    }
                } catch (parseErr) {
                    if (__DEV__) console.error('[WS Tracker] Parse error:', parseErr);
                }
            };

            ws.onclose = () => {
                if (__DEV__) console.log('[WS Tracker] Disconnected');
                wsRef.current = null;
                wsFailCountRef.current++;

                if (isMountedRef.current && enabled) {
                    if (wsFailCountRef.current >= MAX_WS_FAILURES) {
                        // Fall back to REST polling after repeated failures
                        if (__DEV__) console.log('[WS Tracker] Max failures reached, falling back to REST polling');
                        startPolling();
                    } else {
                        // Exponential backoff reconnect
                        const delay = Math.min(1000 * Math.pow(2, wsFailCountRef.current), 10000);
                        reconnectTimerRef.current = setTimeout(connectWs, delay);
                    }
                }
            };

            ws.onerror = (err) => {
                if (__DEV__) console.error('[WS Tracker] Error:', err);
            };

            wsRef.current = ws;
        } catch (e) {
            if (__DEV__) console.error('[WS Tracker] Connection setup failed:', e);
            // Immediately fall back if we can't even build the URL
            startPolling();
        }
    }, [orderId, enabled, getToken, stopPolling, startPolling, queryClient]);

    // ── Lifecycle ──────────────────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;

        if (!orderId || !enabled) {
            setData(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        wsFailCountRef.current = 0;

        // Start with REST to get initial data immediately
        fetchViaRest();
        // Then attempt WebSocket for real-time
        connectWs();

        return () => {
            // Strict cleanup per react-native-best-practices
            isMountedRef.current = false;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            stopPolling();
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [orderId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, isLoading, error };
}
