import { useEffect, useState, useRef } from 'react';
import { getRecentTaskEvents } from '../src/db/eventsDb';
import { getCloudEventsApi } from '../src/api/client';

const LIVE_WS_URL = "wss://taragent.wetarteam.workers.dev/api/live/shop:main";

export interface LiveEvent {
  id?: string;     // Unique event ID for duplicate detection
  opcode: number;
  delta: number;
  streamid: string;
  title?: string;  // For task events - shows task title
  status: string;
  timestamp: string;
  source: 'local' | 'cloud';  // Track if event is from local DB or cloud/remote
}

// Global refresh trigger for instant task event updates
let refreshCallback: (() => void) | null = null;

export function triggerLiveEventsRefresh() {
  console.log('[useLiveEvents] Triggering instant refresh');
  if (refreshCallback) {
    refreshCallback();
  }
}

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const ws = useRef<WebSocket | null>(null);
  const loadRef = useRef<((append?: boolean) => Promise<void>) | null>(null);

  const loadLocalEvents = async (append = false) => {
    console.log('[useLiveEvents] Loading local task events, append:', append);
    try {
      const localEvents = await getRecentTaskEvents(20);
      console.log('[useLiveEvents] Found', localEvents.length, 'local task events');
      
      if (localEvents && localEvents.length > 0) {
        const mappedEvents: LiveEvent[] = localEvents.map((ev: any) => {
          // Parse payload to get task title
          let title: string | undefined;
          try {
            const payload = ev.payload ? JSON.parse(ev.payload) : null;
            title = payload?.title || undefined;
          } catch (e) {
            console.log('[useLiveEvents] Invalid payload JSON for event:', ev.id);
          }
          
          console.log('[useLiveEvents] Mapping event:', { id: ev.id, opcode: ev.opcode, title, task_id: ev.task_id });
          
          return {
            id: ev.id,        // Use unique event ID for duplicate detection
            opcode: ev.opcode,
            delta: ev.delta || 0,
            streamid: ev.task_id,
            title: title,  // Include task title for display
            status: 'local',
            timestamp: ev.ts ? new Date(ev.ts).toLocaleTimeString() : new Date().toLocaleTimeString(),
            source: 'local',  // Mark as local event (from events.db)
          };
        });
        
        if (append) {
          // Append new events to existing ones, avoiding duplicates using unique event ID
          setEvents((prev) => {
            const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
            const newOnly = mappedEvents.filter(e => e.id && !existingIds.has(e.id));
            if (newOnly.length === 0) return prev;
            console.log('[useLiveEvents] Adding', newOnly.length, 'new events');
            return [...newOnly, ...prev].slice(0, 50);
          });
        } else {
          setEvents((prev) => [...mappedEvents, ...prev].slice(0, 50));
        }
      }
    } catch (e) {
      console.error('[useLiveEvents] Failed to load local events:', e);
    }
  };

  // Load cloud events from DO SQLite
  const loadCloudEvents = async (append = false) => {
    console.log('[useLiveEvents] Loading cloud events from DO SQLite, append:', append);
    try {
      const result = await getCloudEventsApi('shop:main', 20);
      console.log('[useLiveEvents] Cloud events API response:', result);
      
      if (result?.success && result?.result && result.result.length > 0) {
        const cloudEvents: LiveEvent[] = result.result.map((ev: any) => {
          // Parse payload to get title for task events
          let title: string | undefined;
          try {
            const payload = ev.payload ? JSON.parse(ev.payload) : null;
            title = payload?.title || undefined;
          } catch (e) {}
          
          return {
            id: ev.id,
            opcode: ev.opcode,
            delta: ev.delta || 0,
            streamid: ev.streamid,
            title: title,
            status: 'cloud',
            timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            source: 'cloud',
          };
        });
        
        console.log('[useLiveEvents] Mapped', cloudEvents.length, 'cloud events');
        
        if (append) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
            const newOnly = cloudEvents.filter(e => e.id && !existingIds.has(e.id));
            if (newOnly.length === 0) return prev;
            console.log('[useLiveEvents] Adding', newOnly.length, 'new cloud events');
            return [...newOnly, ...prev].slice(0, 50);
          });
        } else {
          setEvents((prev) => [...cloudEvents, ...prev].slice(0, 50));
        }
      }
    } catch (e) {
      console.error('[useLiveEvents] Failed to load cloud events:', e);
    }
  };

  // Store the function in ref - only runs once after render
  useEffect(() => {
    loadRef.current = loadLocalEvents;
    // Set up global refresh callback for instant updates
    refreshCallback = () => {
      loadLocalEvents(true);
      loadCloudEvents(true);
    };
    return () => {
      refreshCallback = null;
    };
  }, [loadLocalEvents, loadCloudEvents]);

  // Load local task events on mount
  useEffect(() => {
    loadLocalEvents();
    loadCloudEvents();
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const connectWebSocket = () => {
    setStatus('Connecting...');
    ws.current = new WebSocket(LIVE_WS_URL);

    ws.current.onopen = () => {
      setStatus('Connected');
    };

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const newEvent: LiveEvent = {
          ...data,
          timestamp: new Date().toLocaleTimeString(),
          source: 'cloud',  // Mark as cloud/remote event (from WebSocket)
        };
        
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      } catch (err) {
        console.error("Failed to parse live event", err);
      }
    };

    ws.current.onerror = (e) => {
      setStatus('Error');
    };

    ws.current.onclose = () => {
      setStatus('Reconnecting...');
      setTimeout(connectWebSocket, 3000);
    };
  };

  return { events, status };
}
