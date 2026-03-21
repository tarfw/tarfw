import { Hono } from 'hono';
import { z } from 'zod';
import { InterpreterAgent } from './agents/interpreter';
import { SearchAgent } from './agents/search';
import { getStatesDbClient, getInstancesDbClient } from './db/client';

type Bindings = {
  // States DB (state + stateai)
  STATES_DB_URL: string;
  STATES_DB_TOKEN: string;
  // Instances DB (instance + trace)
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

export default {
  fetch: app.fetch,
};

// Export Durable Objects so Wrangler can bind them
export { OrderDO } from './do/order';
export { TaskDO } from './do/task';
export { ConversationDO, SessionDO } from './do/stubs';

