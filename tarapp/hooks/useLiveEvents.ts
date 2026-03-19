import { useEffect, useState, useRef } from 'react';

const LIVE_WS_URL = "wss://taragent.wetarteam.workers.dev/api/live/shop:main";

export interface LiveEvent {
  opcode: number;
  delta: number;
  streamid: string;
  status: string;
  timestamp: string;
}

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
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
