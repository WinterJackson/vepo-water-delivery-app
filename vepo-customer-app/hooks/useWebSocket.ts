import ApiRoutes from "@/API/routes/ApiRoutes";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from '@clerk/clerk-expo';

export interface OrderUpdate {
  action?: string;
  order_id?: string;
  status?: string;
  [key: string]: any;
}

const useWebSocket = (
  entityType: string,
  entityId: string,
  onOrderUpdate: (data: OrderUpdate) => void
) => {
  const { getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any | null>(null);
  // FIX-WS-RERENDER-01: Stabilize references to prevent dependency-loop re-renders
  const getTokenRef = useRef(getToken);
  const entityTypeRef = useRef(entityType);
  const entityIdRef = useRef(entityId);

  // Keep refs current without triggering useCallback/useEffect dependency changes
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  useEffect(() => { entityTypeRef.current = entityType; }, [entityType]);
  useEffect(() => { entityIdRef.current = entityId; }, [entityId]);

  // BUG-WS-FE-01 FIX: Store latest callback to prevent stale closures and dependency loops
  const onOrderUpdateRef = useRef(onOrderUpdate);
  useEffect(() => {
    onOrderUpdateRef.current = onOrderUpdate;
  }, [onOrderUpdate]);
  
  // Backoff state
  const attemptRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;

  // Guard to prevent connecting after unmount
  const mountedRef = useRef(true);

  // BUG-WS-FE-03 FIX: Use secure URL construction from env vars with flexible fallback
  const BASE_URL = useRef(
    process.env.EXPO_PUBLIC_WS_BASE_URL || ApiRoutes.GetOrders.path.split('/api/')[0].replace('http', 'ws')
  ).current;

  // FIX-WS-RERENDER-02: `connect` has ZERO external dependencies — all values read from refs.
  // This means useCallback never produces a new reference, so the useEffect never re-fires.
  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!entityIdRef.current) return;

    try {
        const token = await getTokenRef.current();
        if (!token || !mountedRef.current) return;

        const ws = new WebSocket(
          `${BASE_URL}/ws/orders/${entityTypeRef.current}/${entityIdRef.current}?token=${token}`
        );

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      if (__DEV__) console.log('WebSocket connected');
      setConnected(true);
      attemptRef.current = 0; // Reset backoff on success
      ws.send(JSON.stringify({ action: 'join-entity-room' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as OrderUpdate;
        // FIX-WS-RERENDER-03: Silently ignore heartbeat messages — they are keep-alive pings,
        // NOT order updates. Previously, every heartbeat triggered refetch() → re-render.
        if (data.action === 'heartbeat') return;
        if (__DEV__) console.log('Received order update:', data);
        onOrderUpdateRef.current(data);
      } catch (err) {
        if (__DEV__) console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (__DEV__) console.log('WebSocket disconnected');
      setConnected(false);
      wsRef.current = null;
      
      if (!mountedRef.current) return;

      // BUG-WS-FE-02 FIX: Exponential backoff with jitter, capped at MAX_RECONNECT_ATTEMPTS
      attemptRef.current += 1;
      if (attemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        if (__DEV__) console.warn('WebSocket max reconnect attempts reached, stopping.');
        return;
      }
      const baseDelay = Math.min(3000 * Math.pow(2, attemptRef.current - 1), 60000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (error) => {
      if (__DEV__) console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
    } catch (e) {
      if (__DEV__) console.error('WebSocket connection failed:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BASE_URL]); // BASE_URL is a stable ref — this callback never changes.

  // FIX-WS-RERENDER-04: Only connect when entityId actually becomes available.
  // Previously this depended on `connect` which changed on every render.
  useEffect(() => {
    if (!entityId) return; // Don't connect until we have a real ID
    
    connect();

    // DOMAIN-3: AppState listener to freeze/restore WS on background/foreground
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Restore connection when foregrounded
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          attemptRef.current = 0; // Reset backoff
          connect();
        }
      } else if (nextState === 'background') {
        // Freeze connection when backgrounded to save battery
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]); // Only re-run when the actual entityId value changes (null → "abc-123")

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { connected, sendMessage };
};

export default useWebSocket;