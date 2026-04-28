import type { Client } from '@libsql/client';
import type { ProductData, CategoryData, SectionState, InstanceData, DesignNode } from '../lib/types';

function parsePayload(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); }
    catch { return {}; }
  }
  return raw;
}

// ─── States ───

export async function getStoreState(db: Client, scope: string) {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = 'store' AND scope = ? LIMIT 1`,
    args: [scope],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { ucode: row.ucode as string, title: row.title as string, payload: parsePayload(row.payload) };
}

export async function getStoreInstances(db: Client, scope: string, limit = 50) {
  const r = await db.execute({
    sql: `SELECT stateid, qty, value, currency, available FROM instance WHERE scope = ? ORDER BY ts DESC LIMIT ?`,
    args: [scope, limit],
  });
  return r.rows.map(row => ({
    stateid: row.stateid as string,
    qty: row.qty as number | null,
    value: row.value as number | null,
    currency: (row.currency as string) || 'INR',
    available: Boolean(row.available),
  }));
}

export async function getProductsByUcodes(db: Client, ucodes: string[]): Promise<ProductData[]> {
  if (ucodes.length === 0) return [];
  const placeholders = ucodes.map(() => '?').join(',');
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE ucode IN (${placeholders}) AND type = 'product'`,
    args: ucodes,
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

export async function getProductByUcode(db: Client, ucode: string): Promise<ProductData | null> {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE ucode = ? AND type = 'product'`,
    args: [ucode],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { ucode: row.ucode as string, title: row.title as string || '', payload: parsePayload(row.payload) };
}

export async function getCategories(db: Client, scope: string): Promise<CategoryData[]> {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = 'category' AND scope = ? ORDER BY ts DESC LIMIT 50`,
    args: [scope],
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

export async function getSections(db: Client, scope: string): Promise<SectionState[]> {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = 'section' AND scope = ? ORDER BY ts DESC`,
    args: [scope],
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

export async function getPages(db: Client, scope: string) {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = 'page' AND scope = ? ORDER BY ts DESC`,
    args: [scope],
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

export async function getPageBySlug(db: Client, slug: string, scope: string) {
  // Pages are stored as page:{slug}
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE ucode = ? AND scope = ?`,
    args: [`page:${slug}`, scope],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { ucode: row.ucode as string, title: row.title as string || '', payload: parsePayload(row.payload) };
}

export async function getStatesByType(db: Client, type: string, scope: string, limit = 50) {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = ? AND scope = ? ORDER BY ts DESC LIMIT ?`,
    args: [type, scope, limit],
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

// ─── Instances ───

export async function getInstancesForProducts(
  db: Client,
  productUcodes: string[],
  scope: string
): Promise<Record<string, InstanceData>> {
  if (productUcodes.length === 0) return {};

  const placeholders = productUcodes.map(() => '?').join(',');
  const r = await db.execute({
    sql: `SELECT stateid, qty, value, currency, available FROM instance WHERE stateid IN (${placeholders}) AND scope = ?`,
    args: [...productUcodes, scope],
  });

  const map: Record<string, InstanceData> = {};
  for (const row of r.rows) {
    map[row.stateid as string] = {
      qty: row.qty as number | null,
      value: row.value as number | null,
      currency: (row.currency as string) || 'INR',
      available: Boolean(row.available),
    };
  }
  return map;
}

export async function getInstanceForProduct(db: Client, ucode: string, scope: string): Promise<InstanceData | null> {
  const r = await db.execute({
    sql: `SELECT qty, value, currency, available FROM instance WHERE stateid = ? AND scope = ? LIMIT 1`,
    args: [ucode, scope],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    qty: row.qty as number | null,
    value: row.value as number | null,
    currency: (row.currency as string) || 'INR',
    available: Boolean(row.available),
  };
}

// ─── Template loading (system:templates scope) ───

export async function getTemplates(db: Client) {
  const r = await db.execute({
    sql: `SELECT ucode, title, payload FROM state WHERE type = 'template' AND scope = 'system:templates' ORDER BY ts DESC`,
    args: [],
  });
  return r.rows.map(row => ({
    ucode: row.ucode as string,
    title: row.title as string || '',
    payload: parsePayload(row.payload),
  }));
}

// ─── Helper: attach instances to products ───

export async function getProductsWithInstances(
  statesDb: Client,
  instancesDb: Client,
  scope: string,
  limit = 50
): Promise<ProductData[]> {
  // Instance-first: get what this store carries, then fetch product definitions
  const instances = await getStoreInstances(instancesDb, scope, limit);
  if (instances.length === 0) return [];

  const ucodes = instances.map(i => i.stateid);
  const products = await getProductsByUcodes(statesDb, ucodes);

  // Build instance lookup
  const instanceMap: Record<string, InstanceData> = {};
  for (const i of instances) {
    instanceMap[i.stateid] = { qty: i.qty, value: i.value, currency: i.currency, available: i.available };
  }

  return products.map(p => ({
    ...p,
    instance: instanceMap[p.ucode] || { qty: null, value: p.payload?.price || null, currency: 'INR', available: true },
  }));
}
