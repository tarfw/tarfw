import { Hono } from 'hono';
import type { Bindings, Variables } from './lib/types';
import { storeMiddleware } from './middleware/store';
import storefront from './routes/storefront';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── CORS ───
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  await next();
});

// ─── Health check ───
app.get('/health', (c) => c.json({ ok: true, worker: 'tarstore' }));

// ─── Store sub-app (shared by subdomain and path routing) ───
const storeApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
storeApp.use('*', storeMiddleware);
storeApp.route('/', storefront);

// ─── Subdomain detection middleware ───
// If request comes via subdomain (e.g. storea.tarai.space), route to store app directly
app.use('*', async (c, next) => {
  const host = new URL(c.req.url).hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'tarstore') {
      // Subdomain detected — delegate to store app
      return storeApp.fetch(c.req.raw, c.env);
    }
  }
  await next();
});

// ─── Path-based store routes: /:slug/* ───
app.route('/:slug', storeApp);

// ─── Root landing (no subdomain, no slug) ───
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>TAR Store</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f7;text-align:center">
<div>
  <h1 style="font-size:32px;font-weight:300;margin-bottom:8px">TAR Store</h1>
  <p style="color:#6e6e73">Access a store via <code style="background:#e5e5ea;padding:2px 8px;border-radius:4px">/{store-slug}</code></p>
</div>
</body></html>`);
});

export default {
  fetch: app.fetch,
};
