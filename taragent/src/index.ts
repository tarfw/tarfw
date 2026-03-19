import { Hono } from 'hono';
import { z } from 'zod';
import { InterpreterAgent } from './agents/interpreter';
import { SearchAgent } from './agents/search';
import { getDbClient } from './db/client';

type Bindings = {
  TURSO_DB_URL: string;
  TURSO_DB_TOKEN: string;
  TASK_DO: DurableObjectNamespace;
  ORDER_DO: DurableObjectNamespace;
  CONVERSATION_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
  AI: any;
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── /api/state — Direct state management (app interface only, no channels) ───

const StateBodySchema = z.object({
  ucode: z.string(),
  title: z.string().optional(),
  payload: z.record(z.any()).optional(),
  scope: z.string().default('shop:main'),
});

// CREATE state
app.post('/api/state', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = StateBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);

    const { ucode, title, payload, scope } = parsed.data;
    const db = getDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_TOKEN);
    const [type] = ucode.split(':');
    const id = crypto.randomUUID();

    // Generate embedding if AI available
    let embeddingStr: string | null = null;
    if (c.env.AI && (title || payload)) {
      try {
        const textToEmbed = `${title || ''} ${JSON.stringify(payload || {})}`.trim();
        const embedResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [textToEmbed] });
        embeddingStr = `[${Array.from(embedResp.data[0] as number[]).join(',')}]`;
      } catch (e) { console.warn('Embedding failed', e); }
    }

    if (embeddingStr) {
      await db.execute({
        sql: 'INSERT INTO state (id, ucode, type, title, payload, scope, embedding) VALUES (?, ?, ?, ?, ?, ?, vector(?))',
        args: [id, ucode, type || 'unknown', title || null, JSON.stringify(payload || {}), scope, embeddingStr],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, ucode, type || 'unknown', title || null, JSON.stringify(payload || {}), scope],
      });
    }

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
    const db = getDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_TOKEN);

    let embeddingStr: string | null = null;
    if (c.env.AI && (body.title || body.payload)) {
      try {
        const textToEmbed = `${body.title || ''} ${JSON.stringify(body.payload || {})}`.trim();
        const embedResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [textToEmbed] });
        embeddingStr = `[${Array.from(embedResp.data[0] as number[]).join(',')}]`;
      } catch (e) { console.warn('Embedding failed', e); }
    }

    if (embeddingStr) {
      await db.execute({
        sql: 'UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload), embedding = vector(?) WHERE ucode = ? AND scope = ?',
        args: [body.title || null, body.payload ? JSON.stringify(body.payload) : null, embeddingStr, ucode, scope],
      });
    } else {
      await db.execute({
        sql: 'UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?',
        args: [body.title || null, body.payload ? JSON.stringify(body.payload) : null, ucode, scope],
      });
    }

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
    const db = getDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_TOKEN);

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
    const db = getDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_TOKEN);

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
    const db = getDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_TOKEN);
    
    // Route to Search Agent if explicitly requested or if text starts with "search"
    if ((requestData.action === "SEARCH" || requestData.text?.toLowerCase().startsWith('search')) && requestData.text) {
      const searchAgent = new SearchAgent(db, c.env);
      const result = await searchAgent.processSearch(requestData.text, requestData.scope || "shop:main");
      return c.json({ success: true, result: { ...result, action: 'SEARCH' } });
    }

    // Natural language → interpreter pipeline (trace + instance + broadcast)
    const interpreter = new InterpreterAgent(db, c.env);
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

