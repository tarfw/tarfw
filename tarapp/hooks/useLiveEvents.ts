import { useEffect, useState, useRef, useCallback } from 'react';
import { getRecentTaskEvents } from '../src/db/eventsDb';
import { getCloudEventsApi, WS_URL } from '../src/api/client';

export interface LiveEvent {
  id?: string;
  opcode: number;
  delta: number;
  streamid: string;
  title?: string;
  status: string;
  timestamp: string;
  rawTimestamp?: string;
  source: 'local' | 'cloud';
}

// Global refresh trigger for local events only
let refreshCallback: (() => void) | null = null;

export function triggerLiveEventsRefresh() {
  console.log('[useLiveEvents] Triggering local refresh');
  if (refreshCallback) refreshCallback();
}

function parseCloudEvent(ev: any): LiveEvent {
  let title: string | undefined;
  try {
    const payload = ev.payload ? (typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload) : null;
    title = payload?.title || undefined;
  } catch (e) {}
  return {
    id: ev.id,
    opcode: ev.opcode,
    delta: ev.delta || 0,
    streamid: ev.streamid,
    title,
    status: 'cloud',
    timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
    rawTimestamp: ev.timestamp || new Date().toISOString(),
    source: 'cloud',
  };
}

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(1000);

  const loadLocalEvents = useCallback(async () => {
    try {
      const localEvents = await getRecentTaskEvents(20);
      if (localEvents && localEvents.length > 0) {
        const mapped: LiveEvent[] = localEvents.map((ev: any) => {
          let title: string | undefined;
          try {
            const payload = ev.payload ? JSON.parse(ev.payload) : null;
            title = payload?.title || undefined;
          } catch (e) {}
          return {
            id: ev.id,
            opcode: ev.opcode,
            delta: ev.delta || 0,
            streamid: ev.task_id,
            title,
            status: 'local',
            timestamp: ev.ts ? new Date(ev.ts).toLocaleTimeString() : new Date().toLocaleTimeString(),
            rawTimestamp: ev.ts || new Date().toISOString(),
            source: 'local' as const,
          };
        });
        setEvents((prev) => {
          const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
          const newOnly = mapped.filter(e => e.id && !existingIds.has(e.id));
          if (newOnly.length === 0) return prev;
          return [...newOnly, ...prev].slice(0, 100);
        });
      }
    } catch (e) {
      console.error('[useLiveEvents] Local events error:', e);
    }
  }, []);

  const loadCloudEvents = useCallback(async () => {
    try {
      const result = await getCloudEventsApi('shop:main', 50);
      if (result?.success && result?.result?.length > 0) {
        const cloudEvents = result.result.map(parseCloudEvent);
        setEvents((prev) => {
          const localEvents = prev.filter(e => e.source === 'local');
          const cloudIds = new Set(cloudEvents.map((e: LiveEvent) => e.id));
          const localOnly = localEvents.filter(e => !e.id || !cloudIds.has(e.id));
          return [...cloudEvents, ...localOnly]
            .sort((a, b) => (b.rawTimestamp || '').localeCompare(a.rawTimestamp || ''))
            .slice(0, 100);
        });
      }
    } catch (e) {
      console.error('[useLiveEvents] Cloud events error:', e);
    }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = `${WS_URL}/shop:main`;
    console.log('[useLiveEvents] Connecting WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      console.log('[useLiveEvents] WebSocket connected');
      setStatus('Connected');
      backoff.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle delete broadcast
        if (data.type === 'delete' && data.id) {
          setEvents((prev) => prev.filter(e => e.id !== data.id));
          return;
        }

        // Handle update broadcast
        if (data.type === 'update' && data.id) {
          const updated = parseCloudEvent(data);
          setEvents((prev) => prev.map(e => e.id === data.id ? updated : e));
          return;
        }

        // Could be a single event or an array
        const incoming = Array.isArray(data) ? data : [data];
        const newEvents = incoming.map(parseCloudEvent);

        setEvents((prev) => {
          const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
          const fresh = newEvents.filter(e => e.id && !existingIds.has(e.id));
          if (fresh.length === 0) return prev;
          return [...fresh, ...prev]
            .sort((a, b) => (b.rawTimestamp || '').localeCompare(a.rawTimestamp || ''))
            .slice(0, 100);
        });
      } catch (e) {
        console.error('[useLiveEvents] WS message parse error:', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      console.log('[useLiveEvents] WebSocket closed, reconnecting in', backoff.current, 'ms');
      setStatus('Reconnecting...');
      wsRef.current = null;
      reconnectTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        backoff.current = Math.min(backoff.current * 2, 30000);
        connectWs();
      }, backoff.current);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      console.warn('[useLiveEvents] WebSocket error, will reconnect');
      setStatus('Reconnecting...');
    };
  }, []);

  useEffect(() => {
    refreshCallback = () => loadLocalEvents();
    return () => { refreshCallback = null; };
  }, [loadLocalEvents]);

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    // Initial load via REST
    loadLocalEvents();
    loadCloudEvents();
    // Then connect WebSocket for real-time
    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        // Remove handlers before closing to suppress stale errors
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { events, status };
}
