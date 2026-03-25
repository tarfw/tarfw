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
    // Use exec with no bindings for CREATE TABLE
    this.sql.exec(CREATE_EVENTS_TABLE);
    console.log('[OrderDO] SQLite initialized for cloud events');
    return this.sql;
  }

  // Save event to SQLite with error handling
  async saveCloudEvent(event: {
    opcode: number;
    streamid: string;
    delta?: number;
    payload?: Record<string, any>;
    scope: string;
  }): Promise<string | null> {
    try {
      console.log('[OrderDO] saveCloudEvent called with:', event);
      
      const db = await this.initializeSql();
      console.log('[OrderDO] SQL db initialized');
      
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const payloadStr = JSON.stringify(event.payload || {});
      
      // Use exec with parameter bindings (correct API from docs)
      db.exec(
        `INSERT INTO cloud_events (id, opcode, streamid, delta, payload, scope, source, ts)
         VALUES (?, ?, ?, ?, ?, ?, 'cloud', ?)`,
        id, event.opcode, event.streamid, event.delta || 0, payloadStr, event.scope, now
      );
      console.log('[OrderDO] SQL executed successfully');
      
      console.log('[OrderDO] Event saved:', { id, opcode: event.opcode, streamid: event.streamid, scope: event.scope });
      return id;
    } catch (err: any) {
      console.error('[OrderDO] Failed to save event:', { error: err.message, stack: err.stack, event: { opcode: event.opcode, streamid: event.streamid } });
      return null;
    }
  }

  // Check if event already exists (for deduplication) - uses composite key
  async eventExists(opcode: number, streamid: string, scope: string, timeWindowSeconds = 5): Promise<boolean> {
    try {
      const db = await this.initializeSql();
      
      // Use exec with parameter bindings (correct API from docs)
      const cursor = db.exec(
        `SELECT 1 FROM cloud_events 
         WHERE opcode = ? AND streamid = ? AND scope = ? 
         AND ts >= datetime('now', '-${timeWindowSeconds} seconds')
         LIMIT 1`,
        opcode, streamid, scope
      );
      
      // cursor is iterable - use .one() to get first row
      try {
        const row = cursor.one();
        return !!row;
      } catch (e) {
        // one() throws if no rows or more than one row
        return false;
      }
    } catch (err) {
      console.error('[OrderDO] Error checking event existence:', err);
      return false;
    }
  }

  // Get recent events for a scope
  async getRecentEvents(scope: string, limit = 50): Promise<any[]> {
    try {
      const db = await this.initializeSql();
      
      // Use exec with parameter bindings (correct API from docs)
      const cursor = db.exec(
        `SELECT * FROM cloud_events WHERE scope = ? ORDER BY ts DESC LIMIT ?`,
        scope, limit
      );
      
      // cursor is iterable - use .toArray() to get all rows
      const rows = cursor.toArray();
      
      if (!rows || rows.length === 0) {
        return [];
      }
      
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
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      // GET /api/events - fetch recent cloud events
      if (request.method === "GET" && request.url.includes('/api/events')) {
        try {
          const url = new URL(request.url);
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const scope = url.searchParams.get('scope') || DEFAULT_SCOPE;
          console.log('[OrderDO] GET /api/events called, scope:', scope, 'limit:', limit);
          const events = await this.getRecentEvents(scope, limit);
          console.log('[OrderDO] Got events:', events.length);
          return new Response(JSON.stringify(events), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[OrderDO] GET /api/events failed:', err.message);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (request.method === "POST") {
        const payload = await request.text();
        let eventData = null;
        
        // Try to parse and save the event
        try {
          eventData = JSON.parse(payload);
          console.log('[OrderDO] POST payload parsed:', eventData);
          
          if (eventData.opcode && eventData.streamid) {
            const scope = eventData.scope || DEFAULT_SCOPE;
            console.log('[OrderDO] POST received event:', { opcode: eventData.opcode, streamid: eventData.streamid, scope });
            
            // Always save - skip duplicate check for now
            console.log('[OrderDO] Saving event directly...');
            const savedId = await this.saveCloudEvent({
              opcode: eventData.opcode,
              streamid: eventData.streamid,
              delta: eventData.delta,
              payload: eventData.payload,
              scope: scope,
            });
            console.log('[OrderDO] Save result:', savedId);
          } else {
            console.log('[OrderDO] Event missing opcode or streamid:', eventData);
          }
        } catch (e: any) {
          console.log('[OrderDO] JSON parse error:', e.message);
          // Not a valid event JSON, just broadcast
        }
        
        // Broadcast to all WebSocket clients
        const sockets = this.ctx.getWebSockets();
        for (const ws of sockets) {
          try {
            ws.send(payload);
          } catch (e) {
            console.error("Failed to broadcast to session:", e);
          }
        }
        return new Response(JSON.stringify({ broadcast: true, saved: !!eventData }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection explicitly through context
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    console.log(`OrderDO received message: ${message}`);
    
    // Parse and persist WebSocket messages too
    const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let eventData: any = null;
    
    try {
      eventData = JSON.parse(messageStr);
      if (eventData.opcode && eventData.streamid) {
        const scope = eventData.scope || DEFAULT_SCOPE;
        // Check for duplicates before saving (with error handling)
        this.eventExists(eventData.opcode, eventData.streamid, scope, 5)
          .then(async (exists) => {
            if (!exists) {
              await this.saveCloudEvent({
                opcode: eventData.opcode,
                streamid: eventData.streamid,
                delta: eventData.delta,
                payload: eventData.payload,
                scope: scope,
              });
            }
          })
          .catch(err => console.error('[OrderDO] Deduplication check failed:', err));
      }
    } catch (e) {
      // Not a valid event JSON, just broadcast
    }
    
    // Broadcast to all other WebSocket clients
    const sockets = this.ctx.getWebSockets();
    for (const session of sockets) {
      if (session !== ws) {
        try {
          session.send(messageStr);
        } catch (e) {
          console.error("Failed to send message to session:", e);
        }
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {}

  webSocketError(ws: WebSocket, error: unknown) {}
}
