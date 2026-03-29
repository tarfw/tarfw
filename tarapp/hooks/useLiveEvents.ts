import { useEffect, useState, useRef, useCallback } from 'react';
import { getCloudEventsApi, WS_URL } from '../src/api/client';
import { getAuthToken } from '../src/auth/googleSignIn';

export interface LiveEvent {
  id?: string;
  opcode: number;
  delta: number;
  streamid: string;
  title?: string;
  stateid?: string;
  status: string;
  timestamp: string;
  rawTimestamp?: string;
  source: 'local' | 'cloud';
}

function parseCloudEvent(ev: any): LiveEvent {
  let title: string | undefined;
  let stateid: string | undefined;
  try {
    const payload = ev.payload ? (typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload) : null;
    title = payload?.title || undefined;
    stateid = payload?.stateid || undefined;
  } catch (e) {}

  const rawTimestamp = ev.timestamp || new Date().toISOString();
  const syntheticId = ev.id || `${ev.streamid}_${ev.opcode}_${ev.delta}_${ev.timestamp}`;

  return {
    id: syntheticId,
    opcode: ev.opcode,
    delta: ev.delta || 0,
    streamid: ev.streamid,
    title,
    stateid,
    status: 'cloud',
    timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
    rawTimestamp,
    source: 'cloud',
  };
}

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(1000);
  const mountedRef = useRef(false);

  // ─── Microbatch: collect WS events, flush once per 300ms ───
  const batchRef = useRef<LiveEvent[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBatch = useCallback(() => {
    batchTimer.current = null;
    const batch = batchRef.current;
    if (batch.length === 0) return;
    batchRef.current = [];

    setEvents((prev) => {
      const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
      const fresh = batch.filter(e => e.id && !existingIds.has(e.id));
      if (fresh.length === 0) return prev;
      return [...fresh, ...prev]
        .sort((a, b) => (b.rawTimestamp || '').localeCompare(a.rawTimestamp || ''))
        .slice(0, 100);
    });
  }, []);

  const enqueueEvent = useCallback((ev: LiveEvent) => {
    batchRef.current.push(ev);
    if (!batchTimer.current) {
      batchTimer.current = setTimeout(flushBatch, 300);
    }
  }, [flushBatch]);

  const loadCloudEvents = useCallback(async () => {
    try {
      const result = await getCloudEventsApi('shop:main', 50);
      if (result?.success && result?.result?.length > 0) {
        const cloudEvents = result.result.map(parseCloudEvent)
          .sort((a: LiveEvent, b: LiveEvent) => (b.rawTimestamp || '').localeCompare(a.rawTimestamp || ''))
          .slice(0, 100);
        setEvents(cloudEvents);
      } else if (result?.success && result?.result?.length === 0) {
        setEvents([]);
      }
    } catch (e) {
      console.error('[useLiveEvents] Cloud events error:', e);
    }
  }, []);

  // ─── WebSocket ───

  const connectWs = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    let wsUrl = `${WS_URL}/shop:main`;
    try {
      const token = await getAuthToken();
      if (token) wsUrl += `?token=${encodeURIComponent(token)}`;
    } catch (e) {}

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setStatus('Connected');
      backoff.current = 1000;
      loadCloudEvents();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'delete' && data.id) {
          setEvents((prev) => prev.filter(e => e.id !== data.id));
          return;
        }

        if (data.type === 'update' && data.id) {
          const updated = parseCloudEvent(data);
          setEvents((prev) => prev.map(e => e.id === data.id ? updated : e));
          return;
        }

        // New event(s) — batch them
        const incoming = Array.isArray(data) ? data : [data];
        for (const raw of incoming) {
          enqueueEvent(parseCloudEvent(raw));
        }
      } catch (e) {
        console.error('[useLiveEvents] WS message parse error:', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setStatus('Reconnecting...');
      reconnectTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        backoff.current = Math.min(backoff.current * 2, 30000);
        connectWs();
      }, backoff.current);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus('Reconnecting...');
    };
  }, [loadCloudEvents, enqueueEvent]);

  useEffect(() => {
    mountedRef.current = true;
    loadCloudEvents();
    connectWs();

    return () => {
      mountedRef.current = false;
      if (batchTimer.current) {
        clearTimeout(batchTimer.current);
        batchTimer.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
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
