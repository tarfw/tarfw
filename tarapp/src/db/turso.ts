import { Database, getDbPath } from '@tursodatabase/sync-react-native';
import { createStateApi, updateStateApi, deleteStateApi, searchServerApi } from '../api/client';

// ─── Instance DB (Local-first) ───
// Only sync instance + events tables from instances-tarframework
const INSTANCES_DB_URL = 'libsql://instances-tarframework.aws-eu-west-1.turso.io';
const INSTANCES_DB_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQxOTQ0MDEsImlkIjoiMDE5ZDBmNTYtYTEwMS03OWE2LWJhYWMtY2Y4YjFiNGJjNDE3IiwicmlkIjoiMmNkM2U4OGItNGU0ZS00NTgzLWI1OGMtYzVjZGIzYjI3NzAyIn0.CaAlMH84Tk3LWiGyeY1--0dxmKd4k9lE2RyfSGPcX8bewQCIXpFagYT2SeMVCvvbvRxrSD5pM5dwABNTddcHCQ';

// Single database instance with cached init promise (local-first for instances)
let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Initialize instance schema only (local-first tables)
async function initSchema(db: Database) {
  const schema = [
    `CREATE TABLE IF NOT EXISTS instance (
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
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      streamid TEXT NOT NULL,
      opcode INTEGER NOT NULL,
      delta REAL,
      lat REAL,
      lng REAL,
      payload TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      scope TEXT
    )`,
  ];

  for (const statement of schema) {
    try {
      await db.exec(statement);
    } catch (e: any) {
      // Table might already exist - ignore
    }
  }
}

// ─── Instance DB Connection (Local-first, like @tar) ───
export async function getInstancesDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dbPath = getDbPath('instances.db');
    const instance = new Database({
      path: dbPath,
      url: INSTANCES_DB_URL,
      authToken: INSTANCES_DB_TOKEN,
    });

    // Connect first
    await instance.connect();
    
    // Initialize schema
    await initSchema(instance);

    dbInstance = instance;
    return instance;
  })();

  return initPromise;
}

// ─── Sync functions for instances (local-first) ───
export async function pullData() {
  const db = await getInstancesDb();
  try {
    await db.push();
    await db.pull();
  } catch (e: any) {
    throw e;
  }
}

export async function forcePullData() {
  const db = await getInstancesDb();
  try {
    await db.run('DELETE FROM instance');
    await db.push();
    await db.pull();
  } catch (e: any) {
    throw e;
  }
}

export async function pushData() {
  const db = await getInstancesDb();
  try {
    await db.push();
  } catch (e: any) {
    throw e;
  }
}

export async function syncDb() {
  const db = await getInstancesDb();
  try {
    await db.push();
    await db.pull();
    return true;
  } catch (error: any) {
    return false;
  }
}

// ─── Instance CRUD (Local-first) ───

export interface Instance {
  id: string;
  stateid: string;
  type?: string;
  scope?: string;
  qty?: number;
  value?: number;
  currency?: string;
  available?: number;
  lat?: number;
  lng?: number;
  h3?: string;
  startts?: string;
  endts?: string;
  ts?: string;
  payload?: string;
}

// Simple UUID generator compatible with React Native
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Import API functions
import { createInstanceApi, getInstancesByStateApi, updateInstanceApi, deleteInstanceApi } from '../api/client';

// Get ALL instances from local DB (for Memories screen)
export async function getAllInstances(scope = 'shop:main'): Promise<Instance[]> {
  try {
    const db = await getInstancesDb();
    
    const rows = await db.all(
      'SELECT id, stateid, type, scope, qty, value, currency, available, lat, lng, h3, startts, endts, ts, payload FROM instance ORDER BY ts DESC'
    );
    
    if (rows && rows.length > 0) {
      return rows.map((row: any) => ({
        id: row.id,
        stateid: row.stateid,
        type: row.type,
        scope: row.scope,
        qty: row.qty,
        value: row.value,
        currency: row.currency,
        available: row.available,
        lat: row.lat,
        lng: row.lng,
        h3: row.h3,
        startts: row.startts,
        endts: row.endts,
        ts: row.ts,
        payload: row.payload,
      }));
    }
    return [];
  } catch (localErr: any) {
    // Fallback to API
    try {
      const { getAllStates } = await import('./turso');
      const states = await getAllStates(scope);
      const allInst: Instance[] = [];
      for (const state of states) {
        const stateUcode = String(state.ucode || '');
        if (!stateUcode) continue;
        const instances = await getInstancesByStateApi(stateUcode, scope);
        if (instances.result) {
          allInst.push(...instances.result.map((row: any) => ({
            id: row.id,
            stateid: row.stateid,
            type: row.type,
            scope: row.scope,
            qty: row.qty,
            value: row.value,
            currency: row.currency,
            available: row.available,
            lat: row.lat,
            lng: row.lng,
            h3: row.h3,
            startts: row.startts,
            endts: row.endts,
            ts: row.ts,
            payload: row.payload,
          })));
        }
      }
      return allInst;
    } catch (apiErr: any) {
      return [];
    }
  }
}

// Get instances filtered by stateid (for detail views)
export async function getInstancesByState(stateid: string, scope = 'shop:main'): Promise<Instance[]> {
  // Fast local-first read
  try {
    const db = await getInstancesDb();
    
    const rows = await db.all(
      'SELECT id, stateid, type, scope, qty, value, currency, available, lat, lng, h3, startts, endts, ts, payload FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC',
      stateid, scope
    );
    
    if (rows && rows.length > 0) {
      return rows.map((row: any) => ({
        id: row.id,
        stateid: row.stateid,
        type: row.type,
        scope: row.scope,
        qty: row.qty,
        value: row.value,
        currency: row.currency,
        available: row.available,
        lat: row.lat,
        lng: row.lng,
        h3: row.h3,
        startts: row.startts,
        endts: row.endts,
        ts: row.ts,
        payload: row.payload,
      }));
    }
    return [];
  } catch (localErr: any) {
    // Fallback to API if local DB fails
    try {
      const response = await getInstancesByStateApi(stateid, scope);
      if (response.result) {
        return response.result.map((row: any) => ({
          id: row.id,
          stateid: row.stateid,
          type: row.type,
          scope: row.scope,
          qty: row.qty,
          value: row.value,
          currency: row.currency,
          available: row.available,
          lat: row.lat,
          lng: row.lng,
          h3: row.h3,
          startts: row.startts,
          endts: row.endts,
          ts: row.ts,
          payload: row.payload,
        }));
      }
      return [];
    } catch (apiErr: any) {
      return [];
    }
  }
}

// Local-first instance creation
export async function createInstance(data: {
  stateid: string;
  type?: string;
  scope?: string;
  qty?: number;
  value?: number;
  currency?: string;
  available?: boolean;
  lat?: number;
  lng?: number;
  h3?: string;
  startts?: string;
  endts?: string;
  payload?: Record<string, any>;
}) {
  const id = generateUUID();
  const scope = data.scope || 'shop:main';
  
  // Try local-first: write to local DB, then sync to remote
  try {
    const db = await getInstancesDb();
    
    // Insert locally first
    await db.run(
      `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, lat, lng, h3, startts, endts, ts, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.stateid,
        data.type || 'inventory',
        scope,
        data.qty ?? null,
        data.value ?? null,
        data.currency || 'INR',
        data.available ?? true ? 1 : 0,
        data.lat ?? null,
        data.lng ?? null,
        data.h3 ?? null,
        data.startts ?? null,
        data.endts ?? null,
        new Date().toISOString(),
        data.payload ? JSON.stringify(data.payload) : null
      ]
    );
    
    // Sync to remote in background
    try {
      await createInstanceApi({
        id,
        stateid: data.stateid,
        type: data.type || 'inventory',
        scope,
        qty: data.qty,
        value: data.value,
        currency: data.currency || 'INR',
        available: data.available ?? true,
        lat: data.lat,
        lng: data.lng,
        h3: data.h3,
        startts: data.startts,
        endts: data.endts,
        payload: data.payload,
      });
    } catch (syncErr: any) {
      // Continue even if remote sync fails - local is saved
    }
    
    return { success: true, id, local: true };
  } catch (localErr: any) {
    // Local DB failed - fallback to API only
    try {
      const response = await createInstanceApi({
        id,
        stateid: data.stateid,
        type: data.type || 'inventory',
        scope,
        qty: data.qty,
        value: data.value,
        currency: data.currency || 'INR',
        available: data.available ?? true,
        lat: data.lat,
        lng: data.lng,
        h3: data.h3,
        startts: data.startts,
        endts: data.endts,
        payload: data.payload,
      });
      return { success: true, id, remote: true };
    } catch (apiErr: any) {
      return { success: false, id, error: apiErr.message };
    }
  }
}

// Local-first instance update
export async function updateInstance(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.qty !== undefined) { fields.push('qty = ?'); values.push(data.qty); }
  if (data.value !== undefined) { fields.push('value = ?'); values.push(data.value); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
  if (data.available !== undefined) { fields.push('available = ?'); values.push(data.available ? 1 : 0); }
  if (data.lat !== undefined) { fields.push('lat = ?'); values.push(data.lat); }
  if (data.lng !== undefined) { fields.push('lng = ?'); values.push(data.lng); }
  if (data.h3 !== undefined) { fields.push('h3 = ?'); values.push(data.h3); }
  if (data.startts !== undefined) { fields.push('startts = ?'); values.push(data.startts); }
  if (data.endts !== undefined) { fields.push('endts = ?'); values.push(data.endts); }
  if (data.payload !== undefined) { fields.push('payload = ?'); values.push(JSON.stringify(data.payload)); }
  
  if (fields.length === 0) {
    return { success: false, id, error: 'No fields to update' };
  }
  
  // 1. Update locally first
  const db = await getInstancesDb();
  values.push(id);
  await db.run(
    `UPDATE instance SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  // 2. API sync in background
  try {
    await updateInstanceApi(id, data);
  } catch (e: any) {
    // Continue silently - local update is saved
  }
  
  // 3. Pull to sync in background
  try {
    await pullData();
  } catch (e: any) {
    // Continue silently
  }
  
  return { success: true, id, local: true };
}

// Local-first instance delete
export async function deleteInstance(id: string) {
  // 1. Delete locally first
  const db = await getInstancesDb();
  await db.run('DELETE FROM instance WHERE id = ?', [id]);
  
  // 2. API sync in background
  try {
    await deleteInstanceApi(id);
  } catch (e: any) {
    // Continue silently - local delete is saved
  }
  
  // 3. Pull to sync in background
  try {
    await pullData();
  } catch (e: any) {
    // Continue silently
  }
  
  return { success: true, id, local: true };
}

// ─── States - Remote-only (HTTP API, no local sync) ───
// States use HTTP API for vector search, no local database needed

export async function getAllStates(scope = 'shop:main') {
  // Use HTTP API - no local sync
  try {
    const { listStatesApi } = await import('../api/client');
    const response = await listStatesApi(scope);
    return response.result || [];
  } catch (e) {
    console.warn('Failed to fetch states from API:', e);
    return [];
  }
}

export async function createStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main') {
  const result = await createStateApi(ucode, title, payload, scope);
  return result.result?.id || ucode;
}

export async function updateStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main') {
  await updateStateApi(ucode, title, payload, scope);
}

export async function deleteStateLocal(ucode: string, scope = 'shop:main') {
  await deleteStateApi(ucode, scope);
}

// State vector search - use server API (remote-only)
export async function searchStates(queryVector: number[], scope = 'shop:main', limit = 10) {
  // Use server-side vector search (HTTP API)
  try {
    return await searchServerApi(queryVector, scope, limit);
  } catch (e) {
    console.warn('Vector search failed:', e);
    return [];
  }
}

// Helper functions - not needed for remote-only states but keep for compatibility
export async function getStateIdByUcode(_ucode: string, _scope = 'shop:main'): Promise<string | null> {
  // States are remote-only, no local ID
  return null;
}

export async function getStatesWithoutEmbeddings(_scope = 'shop:main') {
  // States are remote-only, embeddings managed server-side
  return [];
}

export async function upsertEmbedding(_stateId: string, _vector: number[]) {
  // Embeddings handled server-side for states
}

// Legacy aliases for backward compatibility
export async function pullStatesData() {
  // No-op for remote-only states
}

export async function pullInstancesData() {
  return pullData();
}

export async function getStatesDb() {
  // Not used - states are remote-only
  return getInstancesDb();
}