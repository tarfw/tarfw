import { DurableObject } from 'cloudflare:workers';

// ─── Constants ───
export const DEFAULT_SCOPE = 'shop:main';

// ─── Event Schema for Cloud Event Persistence ───
const CREATE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS cloud_events (
  id TEXT PRIMARY KEY,
  opcode INTEGER NOT NULL,
  streamid TEXT NOT NULL,
  delta REAL DEFAULT 0,
  payload TEXT,
  scope TEXT NOT NULL,
  source TEXT DEFAULT 'cloud',
  ts TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_scope ON cloud_events(scope);
CREATE INDEX IF NOT EXISTS idx_events_ts ON cloud_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_opcode ON cloud_events(opcode);
CREATE INDEX IF NOT EXISTS idx_events_composite ON cloud_events(opcode, streamid, ts);
`;

export class OrderDO extends DurableObject {
  private sql: any = null;

  async initializeSql() {
    if (this.sql) return this.sql;
    this.sql = this.ctx.storage.sql;
    this.sql.exec(CREATE_EVENTS_TABLE);
    console.log('[OrderDO] SQLite initialized for cloud events');
    return this.sql;
  }

  async saveCloudEvent(event: {
    opcode: number;
    streamid: string;
    delta?: number;
    payload?: Record<string, any>;
    scope: string;
  }): Promise<string | null> {
    try {
      const db = await this.initializeSql();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const payloadStr = JSON.stringify(event.payload || {});

      db.exec(
        `INSERT INTO cloud_events (id, opcode, streamid, delta, payload, scope, source, ts)
         VALUES (?, ?, ?, ?, ?, ?, 'cloud', ?)`,
        id, event.opcode, event.streamid, event.delta || 0, payloadStr, event.scope, now
      );
      return id;
    } catch (err: any) {
      console.error('[OrderDO] Failed to save event:', err.message);
      return null;
    }
  }

  async eventExists(opcode: number, streamid: string, scope: string, timeWindowSeconds = 5): Promise<boolean> {
    try {
      const db = await this.initializeSql();
      const cursor = db.exec(
        `SELECT 1 FROM cloud_events 
         WHERE opcode = ? AND streamid = ? AND scope = ? 
         AND ts >= datetime('now', '-${timeWindowSeconds} seconds')
         LIMIT 1`,
        opcode, streamid, scope
      );
      try {
        const row = cursor.one();
        return !!row;
      } catch (e) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  async getRecentEvents(scope: string, limit = 50): Promise<any[]> {
    try {
      const db = await this.initializeSql();
      const cursor = db.exec(
        `SELECT * FROM cloud_events WHERE scope = ? ORDER BY ts DESC LIMIT ?`,
        scope, limit
      );
      const rows = cursor.toArray();
      if (!rows || rows.length === 0) return [];

      return rows.map((row: any) => ({
        id: row.id,
        opcode: row.opcode,
        streamid: row.streamid,
        delta: row.delta,
        payload: row.payload ? JSON.parse(row.payload) : {},
        source: row.source,
        scope: row.scope,
        timestamp: row.ts,
      }));
    } catch (err) {
      console.error('[OrderDO] getRecentEvents error:', err);
      throw new Error(`Failed to get events: ${err}`);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');

    // Handle WebSocket upgrade FIRST - before any SQLite operations
    if (upgradeHeader === 'websocket') {
      console.log('[OrderDO] WebSocket upgrade request');
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.ctx.acceptWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle REST API requests
    if (request.method === "GET" && request.url.includes('/api/events')) {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const scope = url.searchParams.get('scope') || DEFAULT_SCOPE;
        const events = await this.getRecentEvents(scope, limit);
        return new Response(JSON.stringify(events), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    if (request.method === "POST") {
      const payload = await request.text();
      let eventData = null;
      let savedId: string | null = null;

      try {
        eventData = JSON.parse(payload);
        if (eventData.opcode && eventData.streamid) {
          const scope = eventData.scope || DEFAULT_SCOPE;
          savedId = await this.saveCloudEvent({
            opcode: eventData.opcode,
            streamid: eventData.streamid,
            delta: eventData.delta,
            payload: eventData.payload,
            scope: scope,
          });
        }
      } catch (e: any) {
        console.log('[OrderDO] JSON parse error:', e.message);
      }

      // Broadcast the saved event (with id + timestamp) so clients can dedup
      const broadcastMsg = savedId && eventData
        ? JSON.stringify({
            id: savedId,
            opcode: eventData.opcode,
            streamid: eventData.streamid,
            delta: eventData.delta ?? 0,
            payload: eventData.payload || {},
            scope: eventData.scope || DEFAULT_SCOPE,
            timestamp: new Date().toISOString(),
          })
        : payload;
      const sockets = this.ctx.getWebSockets();
      for (const ws of sockets) {
        try { ws.send(broadcastMsg); } catch (e) {}
      }
      return new Response(JSON.stringify({ broadcast: true, saved: !!savedId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const eventId = url.searchParams.get('id');

      if (!eventId) {
        return new Response(JSON.stringify({ error: 'Event ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      try {
        const db = await this.initializeSql();
        db.exec(`DELETE FROM cloud_events WHERE id = ?`, eventId);
        // Broadcast delete to all WS clients
        const deleteMsg = JSON.stringify({ type: 'delete', id: eventId });
        const sockets = this.ctx.getWebSockets();
        for (const ws of sockets) {
          try { ws.send(deleteMsg); } catch (e) {}
        }
        return new Response(JSON.stringify({ success: true, deleted: eventId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    if (request.method === "PUT") {
      const url = new URL(request.url);
      const eventId = url.searchParams.get('id');
      const body = await request.json();

      if (!eventId) {
        return new Response(JSON.stringify({ error: 'Event ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      try {
        const db = await this.initializeSql();
        const { opcode, streamid, delta, payload } = body;
        db.exec(`UPDATE cloud_events SET opcode = ?, streamid = ?, delta = ?, payload = ? WHERE id = ?`,
          opcode, streamid, delta || 0, JSON.stringify(payload || {}), eventId);
        // Broadcast update to all WS clients
        const updatedRow = db.exec(`SELECT * FROM cloud_events WHERE id = ?`, eventId).toArray();
        if (updatedRow.length > 0) {
          const row = updatedRow[0] as any;
          const updateMsg = JSON.stringify({
            type: 'update',
            id: row.id,
            opcode: row.opcode,
            streamid: row.streamid,
            delta: row.delta,
            payload: row.payload ? JSON.parse(row.payload) : {},
            scope: row.scope,
            timestamp: row.ts,
          });
          const sockets = this.ctx.getWebSockets();
          for (const ws of sockets) {
            try { ws.send(updateMsg); } catch (e) {}
          }
        }
        return new Response(JSON.stringify({ success: true, updated: eventId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let eventData: any = null;
    let broadcastMsg = messageStr;

    try {
      eventData = JSON.parse(messageStr);
      if (eventData.opcode && eventData.streamid) {
        const scope = eventData.scope || DEFAULT_SCOPE;
        this.eventExists(eventData.opcode, eventData.streamid, scope, 5)
          .then(async (exists) => {
            if (!exists) {
              const savedId = await this.saveCloudEvent({
                opcode: eventData.opcode,
                streamid: eventData.streamid,
                delta: eventData.delta,
                payload: eventData.payload,
                scope: scope,
              });
              // Broadcast saved event with id to other clients
              if (savedId) {
                const saved = JSON.stringify({
                  id: savedId,
                  opcode: eventData.opcode,
                  streamid: eventData.streamid,
                  delta: eventData.delta ?? 0,
                  payload: eventData.payload || {},
                  scope,
                  timestamp: new Date().toISOString(),
                });
                const sockets = this.ctx.getWebSockets();
                for (const session of sockets) {
                  if (session !== ws) {
                    try { session.send(saved); } catch (e) {}
                  }
                }
              }
            }
          })
          .catch(err => console.error('[OrderDO] Deduplication check failed:', err));
        return; // broadcast handled in the async chain above
      }
    } catch (e) {}

    // Non-event messages: broadcast as-is
    const sockets = this.ctx.getWebSockets();
    for (const session of sockets) {
      if (session !== ws) {
        try { session.send(broadcastMsg); } catch (e) {}
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {}
  webSocketError(ws: WebSocket, error: unknown) {}
}