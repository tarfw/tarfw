import { Hono } from 'hono';
import { z } from 'zod';
import { InterpreterAgent } from './agents/interpreter';
import { SearchAgent } from './agents/search';
import { getStatesDbClient, getInstancesDbClient } from './db/client';

type Bindings = {
  // States DB (state + stateai)
  STATES_DB_URL: string;
  STATES_DB_TOKEN: string;
  // Instances DB (instance + events)
  INSTANCES_DB_URL: string;
  INSTANCES_DB_TOKEN: string;
  // Durable Objects
  TASK_DO: DurableObjectNamespace;
  ORDER_DO: DurableObjectNamespace;
  CONVERSATION_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── /api/state — Direct state management (app interface only, no channels) ───

const StateBodySchema = z.object({
  ucode: z.string(),
  title: z.string().optional(),
  payload: z.record(z.any()).optional(),
  scope: z.string().default('shop:main'),
});

// CREATE state (embeddings now come from mobile app - local MiniLM)
app.post('/api/state', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = StateBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const { ucode, title, payload, scope } = parsed.data;
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
    const [type] = ucode.split(':');
    const id = crypto.randomUUID();

    // Note: embeddings are now generated locally on mobile and sent via stateai table
    // Mobile app generates embedding with MiniLM and calls separate API to store
    await db.execute({
      sql: 'INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, ucode, type || 'unknown', title || null, JSON.stringify(payload || {}), scope],
    });

    return c.json({ success: true, result: { ucode, title, payload, scope } }, 201);
  } catch (err: any) {
    console.error('State CREATE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// UPDATE state
app.put('/api/state/:ucode', async (c) => {
  try {
    const ucode = c.req.param('ucode');
    const body = await c.req.json();
    const scope = body.scope || 'shop:main';
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    // Embeddings updated separately by mobile app via stateai table
    await db.execute({
      sql: 'UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?',
      args: [body.title || null, body.payload ? JSON.stringify(body.payload) : null, ucode, scope],
    });

    return c.json({ success: true, result: { ucode, ...body } });
  } catch (err: any) {
    console.error('State UPDATE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// DELETE state
app.delete('/api/state/:ucode', async (c) => {
  try {
    const ucode = c.req.param('ucode');
    const scope = c.req.query('scope') || 'shop:main';
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    await db.execute({
      sql: 'DELETE FROM state WHERE ucode = ? AND scope = ?',
      args: [ucode, scope],
    });

    return c.json({ success: true, result: { ucode, deleted: true } });
  } catch (err: any) {
    console.error('State DELETE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// READ state
app.get('/api/state/:ucode', async (c) => {
  try {
    const ucode = c.req.param('ucode');
    const scope = c.req.query('scope') || 'shop:main';
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    const result = await db.execute({
      sql: 'SELECT id, ucode, type, title, payload, scope, created_at FROM state WHERE ucode = ? AND scope = ?',
      args: [ucode, scope],
    });

    if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true, result: result.rows[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// LIST all states - for instance creation flow (search/select state)
app.get('/api/states', async (c) => {
  try {
    const scope = c.req.query('scope') || 'shop:main';
    const type = c.req.query('type'); // optional filter
    const limit = parseInt(c.req.query('limit') || '50');
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    let sql = 'SELECT id, ucode, type, title, payload, scope FROM state WHERE scope = ?';
    const args: any[] = [scope];

    if (type) {
      sql += ' AND type = ?';
      args.push(type);
    }

    sql += ' ORDER BY ts DESC LIMIT ?';
    args.push(limit);

    const result = await db.execute({ sql, args });
    return c.json({ success: true, result: result.rows });
  } catch (err: any) {
    console.error('States LIST error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── /api/instance — Instance CRUD (working state under products/services) ───

const InstanceBodySchema = z.object({
  id: z.string().optional(), // Optional: pass local ID to ensure consistency
  stateid: z.string(), // The ucode of the parent state (e.g., "product:coffee")
  type: z.string().default('inventory'),
  scope: z.string().default('shop:main'),
  qty: z.number().optional(),
  value: z.number().optional(),
  currency: z.string().default('INR'),
  available: z.boolean().default(true),
  lat: z.number().optional(),
  lng: z.number().optional(),
  h3: z.string().optional(),
  startts: z.string().optional(),
  endts: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

// CREATE instance - using INSTANCES DB (local-first for client sync)
app.post('/api/instance', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = InstanceBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const data = parsed.data;
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    console.log('[INSTANCE CREATE] DB URL:', c.env.INSTANCES_DB_URL);
    
    // Use INSTANCES DB - this is where client syncs from (instances-tarframework)
    const db = getInstancesDbClient(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);
    console.log('[INSTANCE CREATE] Client created, checking existing tables...');

    // First check what tables exist
    try {
      const tables = await db.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table'",
        args: []
      });
      console.log('[INSTANCE CREATE] Existing tables:', tables.rows);
    } catch (checkErr: any) {
      console.log('[INSTANCE CREATE] Table check error (may be empty DB):', checkErr.message);
    }

    // Create tables if not exists
    try {
      // Create instance table
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS instance (
          id TEXT PRIMARY KEY,
          stateid TEXT NOT NULL,
          type TEXT,
          scope TEXT,
          qty REAL,
          value REAL,
          currency TEXT,
          available INTEGER DEFAULT 1,
          lat REAL,
          lng REAL,
          h3 TEXT,
          startts TEXT,
          endts TEXT,
          ts TEXT,
          payload TEXT
        )`,
        args: [],
      });
      console.log('[INSTANCE CREATE] Instance table created/verified');
      
      // Create events table for interpreter
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          streamid TEXT NOT NULL,
          opcode INTEGER NOT NULL,
          status TEXT,
          delta REAL,
          lat REAL,
          lng REAL,
          payload TEXT,
          ts TEXT DEFAULT CURRENT_TIMESTAMP,
          scope TEXT
        )`,
        args: [],
      });
    } catch (tableErr: any) {
      console.error('[INSTANCE CREATE] Table creation error:', tableErr.message);
    }

    // Insert the data
    await db.execute({
      sql: `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, lat, lng, h3, startts, endts, ts, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        data.stateid,
        data.type || 'inventory',
        data.scope || 'shop:main',
        data.qty ?? null,
        data.value ?? null,
        data.currency || 'INR',
        data.available ? 1 : 0,
        data.lat ?? null,
        data.lng ?? null,
        data.h3 ?? null,
        data.startts ?? null,
        data.endts ?? null,
        now,
        data.payload ? JSON.stringify(data.payload) : null
      ],
    });

    return c.json({ success: true, result: { id, ...data } }, 201);
  } catch (err: any) {
    console.error('Instance CREATE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// READ instances by stateid (uses INSTANCES DB - client syncs from this)
app.get('/api/instance/:stateid', async (c) => {
  try {
    const stateid = c.req.param('stateid');
    const scope = c.req.query('scope') || 'shop:main';
    const db = getInstancesDbClient(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

    const result = await db.execute({
      sql: `SELECT * FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC`,
      args: [stateid, scope],
    });

    return c.json({ success: true, result: result.rows });
  } catch (err: any) {
    console.error('Instance READ error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// UPDATE instance (uses INSTANCES DB - client syncs from this)
app.put('/api/instance/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = getInstancesDbClient(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    
    if (body.qty !== undefined) { fields.push('qty = ?'); values.push(body.qty); }
    if (body.value !== undefined) { fields.push('value = ?'); values.push(body.value); }
    if (body.currency !== undefined) { fields.push('currency = ?'); values.push(body.currency); }
    if (body.available !== undefined) { fields.push('available = ?'); values.push(body.available ? 1 : 0); }
    if (body.lat !== undefined) { fields.push('lat = ?'); values.push(body.lat); }
    if (body.lng !== undefined) { fields.push('lng = ?'); values.push(body.lng); }
    if (body.h3 !== undefined) { fields.push('h3 = ?'); values.push(body.h3); }
    if (body.startts !== undefined) { fields.push('startts = ?'); values.push(body.startts); }
    if (body.endts !== undefined) { fields.push('endts = ?'); values.push(body.endts); }
    if (body.payload !== undefined) { fields.push('payload = ?'); values.push(JSON.stringify(body.payload)); }

    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
    
    values.push(id);
    await db.execute({
      sql: `UPDATE instance SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    });

    return c.json({ success: true, result: { id, updated: true } });
  } catch (err: any) {
    console.error('Instance UPDATE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// DELETE instance (uses INSTANCES DB - client syncs from this)
app.delete('/api/instance/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getInstancesDbClient(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

    await db.execute({
      sql: 'DELETE FROM instance WHERE id = ?',
      args: [id],
    });

    return c.json({ success: true, result: { id, deleted: true } });
  } catch (err: any) {
    console.error('Instance DELETE error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── /api/stateai — Embedding management (mobile sends local embeddings) ───

const EmbeddingBodySchema = z.object({
  stateId: z.string(),
  vector: z.array(z.number()).length(384),
});

// UPSERT embedding (mobile app generates locally with MiniLM)
app.post('/api/stateai', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = EmbeddingBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const { stateId, vector } = parsed.data;
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    await db.execute({
      sql: 'INSERT OR REPLACE INTO stateai (state_id, embedding) VALUES (?, vector32(?))',
      args: [stateId, JSON.stringify(vector)],
    });

    return c.json({ success: true, result: { stateId, stored: true } }, 201);
  } catch (err: any) {
    console.error('Embedding UPSERT error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── /api/search — Server-side vector search (mobile sends query vector) ───

const SearchBodySchema = z.object({
  vector: z.array(z.number()).length(384),
  scope: z.string().default('shop:main'),
  limit: z.number().min(1).max(20).default(10),
});

// Server-side semantic search (mobile generates query vector locally with MiniLM)
app.post('/api/search', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SearchBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const { vector, scope, limit } = parsed.data;
    const db = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);

    // Perform vector search using the stateai table
    const result = await db.execute({
      sql: `SELECT s.id, s.ucode, s.type, s.title, s.payload, s.scope,
                   vector_distance_cos(e.embedding, vector32(?)) as distance
            FROM state s
            JOIN stateai e ON s.id = e.state_id
            WHERE s.scope = ?
            ORDER BY distance ASC
            LIMIT ?`,
      args: [JSON.stringify(vector), scope, limit],
    });

    return c.json({ result: result.rows });
  } catch (err: any) {
    console.error('Search error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── /api/channel — Natural language & search only (no state CRUD) ───

const ChannelRequestSchema = z.object({
  channel: z.string(),
  userId: z.string(),
  scope: z.string(),
  text: z.string().optional(),       // Natural language input
  action: z.enum(["SEARCH"]).optional(), // Only SEARCH is supported via channel now
  data: z.record(z.any()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional()
}).refine(data => data.text || data.action, {
  message: "Either 'text' or 'action' must be provided"
});

app.post('/api/channel', async (c) => {
  try {
    const body = await c.req.json();
    
    const parsedData = ChannelRequestSchema.safeParse(body);
    if (!parsedData.success) {
      return c.json({ error: "Invalid request payload", details: parsedData.error.errors }, 400);
    }

    const requestData = parsedData.data;
    
    // Route to Search Agent if explicitly requested or if text starts with "search" (uses states DB)
    if ((requestData.action === "SEARCH" || requestData.text?.toLowerCase().startsWith('search')) && requestData.text) {
      const statesDb = getStatesDbClient(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
      const searchAgent = new SearchAgent(statesDb, c.env);
      const result = await searchAgent.processSearch(requestData.text, requestData.scope || "shop:main");
      return c.json({ success: true, result: { ...result, action: 'SEARCH' } });
    }

    // Natural language → interpreter pipeline (uses instances DB for trace + instance)
    const instancesDb = getInstancesDbClient(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);
    const interpreter = new InterpreterAgent(instancesDb, c.env);
    const result = await interpreter.processIntent(requestData);

    return c.json({ success: true, result });
  } catch (err: any) {
    console.error("Channel Error:", err);
    return c.json({ error: "Internal Server Error", message: err.message }, 500);
  }
});

// ─── /api/event — Test endpoint to emit sample cloud events ───

const SampleEventSchema = z.object({
  opcode: z.number().min(101).max(999),
  streamid: z.string(),
  delta: z.number().default(1),
  payload: z.record(z.any()).optional(),
  scope: z.string().default('shop:main'),
});

// Emit a sample event to all connected WebSocket clients
app.post('/api/event', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SampleEventSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const { opcode, streamid, delta, payload, scope } = parsed.data;
    
    // Get the OrderDO for this scope
    if (!c.env.ORDER_DO) {
      return c.json({ error: 'ORDER_DO not bound' }, 500);
    }
    
    const id = c.env.ORDER_DO.idFromName(scope);
    const stub = c.env.ORDER_DO.get(id);
    
    // Create the event object - include scope
    const event = {
      opcode,
      streamid,
      delta,
      payload: payload || {},
      scope, // Include scope in the event
      timestamp: new Date().toISOString(),
    };
    
    // POST to the DO - use /api/events path for proper handling
    const doUrl = `http://localhost/api/events?limit=1&scope=${scope}`;
    console.log('[API /event] Calling DO at:', doUrl);
    console.log('[API /event] Event payload:', event);
    
    const response = await stub.fetch(new Request(doUrl, {
      method: 'POST',
      body: JSON.stringify(event),
    }));
    
    const responseText = await response.text();
    console.log('[API /event] DO response:', response.status, responseText);
    
    console.log('[SAMPLE EVENT] Broadcast:', event);
    
    return c.json({ 
      success: true, 
      result: { 
        emitted: true, 
        event,
        scope 
      } 
    }, 201);
  } catch (err: any) {
    console.error('Sample event error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// WebSocket Live Tracking Route
app.get('/api/live/:scope', async (c) => {
  const scope = c.req.param('scope');
  if (!c.env.ORDER_DO) {
    return c.json({ error: 'ORDER_DO not bound' }, 500);
  }
  
  const id = c.env.ORDER_DO.idFromName(scope);
  const stub = c.env.ORDER_DO.get(id);
  
  return stub.fetch(c.req.raw);
});

// ─── /api/events/:scope — Get persisted cloud events from DO SQLite ───
app.get('/api/events/:scope', async (c) => {
  const scope = c.req.param('scope');
  const limit = parseInt(c.req.query('limit') || '50');
  
  if (!c.env.ORDER_DO) {
    return c.json({ error: 'ORDER_DO not bound' }, 500);
  }
  
  const id = c.env.ORDER_DO.idFromName(scope);
  const stub = c.env.ORDER_DO.get(id);
  
  // Call DO to get recent events - pass scope as query param
  const response = await stub.fetch(new Request(`http://localhost/api/events?limit=${limit}&scope=${scope}`, {
    method: 'GET',
  }));
  
  // Check for errors from DO
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API /events] DO returned error:', response.status, errorText);
    return c.json({ error: 'DO error', details: errorText }, 500);
  }
  
  const events = await response.json();
  return c.json({ success: true, result: events });
});

// ─── Auth Middleware ───
// Validates session token and checks scope access for protected routes

const PUBLIC_ROUTES = [
  '/auth/google',   // Login endpoint
  '/auth/register', // Registration (if we add it)
];

const PUBLIC_SCOPES = [
  'shop:main', // Default scope for development
];

app.use('*', async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;
  
  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return next();
  }
  
  // Skip auth for GET /api/events/:scope (read-only, public for now)
  // In production, you'd want to protect this too
  if (method === 'GET' && path.startsWith('/api/events/')) {
    return next();
  }
  
  // Get auth token from header
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // For now, allow requests without token but with scope param
  // This is for backwards compatibility during migration
  // TODO: Make this strict after mobile app is updated
  if (!token) {
    // Check if scope is provided in query - allow for now
    const scope = c.req.query('scope');
    if (scope && PUBLIC_SCOPES.includes(scope)) {
      console.log('[Auth] Allowing public access to scope:', scope);
      return next();
    }
    
    // Allow requests without auth header for development
    // Remove this in production!
    console.log('[Auth] No token, allowing (dev mode):', path);
    return next();
  }
  
  // Validate token with SessionDO
  if (!c.env.SESSION_DO) {
    console.error('[Auth] SESSION_DO not bound');
    return c.json({ error: 'Auth not configured' }, 500);
  }
  
  try {
    const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
    const response = await stub.fetch(new Request('http://localhost/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }));
    
    if (!response.ok) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
    }
    
    const authData = await response.json() as any;
    
    // Attach user info to context for handlers (using Hono's set method)
    // Note: In production, you'd want to extend the Variables type
    // @ts-ignore - Hono set method
    c.set('user', authData.user);
    // @ts-ignore
    c.set('userId', authData.user?.id);
    // @ts-ignore
    c.set('scopes', authData.scopes);
    
    // Check scope access if scope is provided
    const scope = c.req.query('scope');
    if (scope && !authData.scopes?.includes(scope)) {
      return c.json({ error: 'Forbidden', message: `No access to scope: ${scope}` }, 403);
    }
    
    console.log('[Auth] Validated:', authData.user?.email, 'scopes:', authData.scopes);
    return next();
  } catch (err: any) {
    console.error('[Auth] Error:', err.message);
    return c.json({ error: 'Auth error', message: err.message }, 500);
  }
});

// ─── Auth Routes (Proxied to SessionDO) ───

// POST /api/auth/google - Login with Google token
app.post('/api/auth/google', async (c) => {
  if (!c.env.SESSION_DO) {
    return c.json({ error: 'SESSION_DO not bound' }, 500);
  }
  
  const body = await c.req.json();
  const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
  
  const response = await stub.fetch(new Request('http://localhost/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});

// GET /api/auth/me - Get current user
app.get('/api/auth/me', async (c) => {
  if (!c.env.SESSION_DO) {
    return c.json({ error: 'SESSION_DO not bound' }, 500);
  }
  
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
  const response = await stub.fetch(new Request('http://localhost/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  }));
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});

// POST /api/auth/logout - Logout
app.post('/api/auth/logout', async (c) => {
  if (!c.env.SESSION_DO) {
    return c.json({ error: 'SESSION_DO not bound' }, 500);
  }
  
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
  const response = await stub.fetch(new Request('http://localhost/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }));
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});

// GET /api/auth/scopes - Get user's scopes
app.get('/api/auth/scopes', async (c) => {
  if (!c.env.SESSION_DO) {
    return c.json({ error: 'SESSION_DO not bound' }, 500);
  }
  
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
  const response = await stub.fetch(new Request('http://localhost/auth/scopes', {
    headers: { 'Authorization': `Bearer ${token}` }
  }));
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});

// POST /api/auth/scopes - Create new scope (store)
app.post('/api/auth/scopes', async (c) => {
  if (!c.env.SESSION_DO) {
    return c.json({ error: 'SESSION_DO not bound' }, 500);
  }
  
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  const body = await c.req.json();
  const stub = c.env.SESSION_DO.get(c.env.SESSION_DO.idFromName('auth'));
  
  const response = await stub.fetch(new Request('http://localhost/auth/scopes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }));
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});

export default {
  fetch: app.fetch,
};

// Export Durable Objects so Wrangler can bind them
export { OrderDO } from './do/order';
export { TaskDO } from './do/task';
export { ConversationDO } from './do/stubs';
export { SessionDO } from './do/session';

