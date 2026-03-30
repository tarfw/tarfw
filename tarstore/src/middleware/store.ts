import type { Context, Next } from 'hono';
import type { Bindings, Variables, StoreData, ThemeConfig } from '../lib/types';
import { getStatesDb } from '../db/client';

const DEFAULT_THEME: ThemeConfig = {
  fonts: { display: 'Inter', body: 'Inter', accent: 'Inter' },
  colors: {
    bg: '#FFFFFF', surface: '#F9F9F9', text: '#1d1d1f',
    textMuted: '#6e6e73', primary: '#007AFF', accent: '#FF9500', border: '#E5E5EA',
  },
  radius: '8px',
  spacing: 'normal',
};

/** Extract store slug and basePath from subdomain or path */
function getRoutingInfo(url: URL): { slug: string; basePath: string } | null {
  const host = url.hostname;

  // Subdomain: storea.tarai.space → slug="storea", basePath=""
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'tarstore') return { slug: sub, basePath: '' };
  }

  // Path: /storea or /storea/products → slug="storea", basePath="/storea"
  const seg = url.pathname.split('/')[1];
  if (seg && !['api', 'assets', 'favicon.ico', 'health'].includes(seg)) {
    return { slug: seg, basePath: `/${seg}` };
  }

  return null;
}

/** Middleware: resolve slug → scope, load store config */
export async function storeMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const url = new URL(c.req.url);
  const info = getRoutingInfo(url);

  if (!info) {
    return c.html('<h1>Store not found</h1><p>Please access via a store URL.</p>', 404);
  }

  const { slug, basePath } = info;
  const scope = `shop:${slug}`;
  c.set('scope', scope);
  c.set('slug', slug);
  c.set('basePath', basePath);

  // Load store config
  const db = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  try {
    const result = await db.execute({
      sql: `SELECT title, payload FROM state WHERE type = 'store' AND scope = ? LIMIT 1`,
      args: [scope],
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload as string) : (row.payload || {});
      const theme = payload.theme || {};

      c.set('storeConfig', {
        name: payload.storeName || row.title || slug,
        tagline: payload.tagline || '',
        logo: payload.logo,
        coverImage: payload.coverImage,
        phone: payload.phone,
        address: payload.address,
        currency: payload.currency || 'INR',
        currencySymbol: payload.currencySymbol || '₹',
        social: payload.social,
        seo: payload.seo,
        theme: {
          fonts: {
            display: theme.fonts?.display || DEFAULT_THEME.fonts.display,
            body: theme.fonts?.body || DEFAULT_THEME.fonts.body,
            accent: theme.fonts?.accent || DEFAULT_THEME.fonts.accent,
          },
          colors: { ...DEFAULT_THEME.colors, ...(theme.colors || {}) },
          radius: theme.radius || DEFAULT_THEME.radius,
          spacing: theme.spacing || DEFAULT_THEME.spacing,
        },
      });
    } else {
      // No store config yet — use defaults
      c.set('storeConfig', {
        name: slug,
        tagline: '',
        currency: 'INR',
        currencySymbol: '₹',
        theme: DEFAULT_THEME,
      } as StoreData['store']);
    }
  } catch (err: any) {
    console.error('[storeMiddleware] DB error:', err.message);
    c.set('storeConfig', {
      name: slug,
      tagline: '',
      currency: 'INR',
      currencySymbol: '₹',
      theme: DEFAULT_THEME,
    } as StoreData['store']);
  }

  await next();
}
