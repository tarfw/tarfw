import { connect, Database } from '@tursodatabase/sync-react-native';
import { createStateApi, updateStateApi, deleteStateApi, upsertEmbeddingApi, createInstanceApi, getInstancesByStateApi, updateInstanceApi, deleteInstanceApi } from '../api/client';

// ─── Two Database Connections ───
// FLIPPED: States now API-only (no sync), Instances now online-first

// States DB: state + stateai → API-ONLY (from states-tarframework)
// No local sync - always fetch from remote API to avoid sync engine issues
const statesDbUrl = 'libsql://states-tarframework.aws-eu-west-1.turso.io';
const statesDbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwNzk5NzQsImlkIjoiMDE5ZDBmNTYtNDAwMS03YWExLThkNWQtOGY1YzkyZGFlMDc2IiwicmlkIjoiZDNmZjRhN2MtOThkZi00OTg3LWJjYjUtMjRlNGEwYTI3OWE1In0.HuH6t-vXlSuvnexhyqU-bEZffYQEPp8bITBD0hzi4Kcmb53XqvzBZUtz8QCjVO9HyOzB9ujnbDtB_maJN8-DAw';

// Instances DB: instance → ONLINE-FIRST (from states-tarframework)
// This DB now handles instances as online-first (the working DB)
const instancesDbUrl = 'libsql://states-tarframework.aws-eu-west-1.turso.io';
const instancesDbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwNzk5NzQsImlkIjoiMDE5ZDBmNTYtNDAwMS03YWExLThkNWQtOGY1YzkyZGFlMDc2IiwicmlkIjoiZDNmZjRhN2MtOThkZi00OTg3LWJjYjUtMjRlNGEwYTI3OWE1In0.HuH6t-vXlSuvnexhyqU-bEZffYQEPp8bITBD0hzi4Kcmb53XqvzBZUtz8QCjVO9HyOzB9ujnbDtB_maJN8-DAw';

// Database handles
let statesDbHandle: Database | null = null;
let instancesDbHandle: Database | null = null;
let embeddingsTableReady = false;
let instancesTablesReady = false;

// Reset instances DB handle - call when schema changes or sync fails
function resetInstancesDb() {
  console.log('[turso] Resetting instances DB handle...');
  instancesDbHandle = null;
  instancesTablesReady = false;
}

async function ensureEmbeddingsTable(db: Database) {
  if (embeddingsTableReady) return;
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS stateai (
        state_id TEXT PRIMARY KEY,
        embedding F32_BLOB(384),
        FOREIGN KEY (state_id) REFERENCES state(id)
      )
    `);
    embeddingsTableReady = true;
  } catch (e: any) {
    console.warn('Failed to create stateai table:', e);
  }
}

async function ensureInstancesTables(db: Database) {
  if (instancesTablesReady) return;
  try {
    // instance table - no foreign keys (state is in different DB)
    await db.run(`
      CREATE TABLE IF NOT EXISTS instance (
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
      )
    `);
    // trace table
    await db.run(`
      CREATE TABLE IF NOT EXISTS trace (
        id TEXT PRIMARY KEY,
        streamid TEXT NOT NULL,
        opcode INTEGER NOT NULL,
        status TEXT,
        delta REAL,
        lat REAL,
        lng REAL,
        payload TEXT,
        ts TEXT,
        scope TEXT
      )
    `);
    // Index for faster lookups
    await db.run(`CREATE INDEX IF NOT EXISTS idx_instance_stateid ON instance(stateid)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_trace_streamid ON trace(streamid)`);
    instancesTablesReady = true;
  } catch (e: any) {
    console.warn('Failed to create instance/trace tables:', e);
  }
}

// ─── States DB (state + stateai) ───
export async function getStatesDb(): Promise<Database> {
  if (!statesDbHandle) {
    statesDbHandle = await connect({
      path: 'states.db',
      url: statesDbUrl,
      authToken: statesDbToken,
    });
    try {
      await statesDbHandle.pull();
    } catch (e: any) {
      console.warn('States DB pull failed:', e);
    }
    await ensureEmbeddingsTable(statesDbHandle);
  }
  return statesDbHandle;
}

// ─── Instances DB (instance + trace) ───
export async function getInstancesDb(): Promise<Database> {
  if (!instancesDbHandle) {
    instancesDbHandle = await connect({
      path: 'instances.db',
      url: instancesDbUrl,
      authToken: instancesDbToken,
    });
    try {
      await instancesDbHandle.pull();
    } catch (e: any) {
      console.warn('Instances DB pull failed:', e);
    }
    await ensureInstancesTables(instancesDbHandle);
  }
  return instancesDbHandle;
}

// Legacy alias
export async function getDb(): Promise<Database> {
  return getStatesDb();
}

// ─── Pull functions for both DBs ───
export async function pullStatesData() {
  const db = await getStatesDb();
  await db.pull();
}

export async function pullInstancesData() {
  const db = await getInstancesDb();
  await db.pull();
}

// Legacy alias
export async function pullData() {
  await pullStatesData();
}

/**
 * State CRUD operations.
 * Reads come from the local replica (pulled from Turso).
 * Writes go through the taragent API, then we pull to sync locally.
 */
export async function getAllStates(scope = 'shop:main') {
  const db = await getDb();
  const rows = await db.all(
    'SELECT * FROM state WHERE scope = ? ORDER BY ts DESC',
    scope
  );
  return rows;
}

export async function createStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main') {
  const result = await createStateApi(ucode, title, payload, scope);
  const db = await getDb();
  await db.pull();
  // Return the id from the newly pulled state
  const rows = await db.all('SELECT id FROM state WHERE ucode = ? AND scope = ? LIMIT 1', ucode, scope);
  return rows.length > 0 ? (rows[0] as any).id : ucode;
}

export async function updateStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main') {
  await updateStateApi(ucode, title, payload, scope);
  const db = await getDb();
  await db.pull();
}

export async function deleteStateLocal(ucode: string, scope = 'shop:main') {
  await deleteStateApi(ucode, scope);
  const db = await getDb();
  await db.pull();
}

export async function upsertEmbedding(stateId: string, vector: number[]) {
  // Store locally for fast offline search
  const db = await getStatesDb();
  await db.run(
    'INSERT OR REPLACE INTO stateai (state_id, embedding) VALUES (?, vector32(?))',
    stateId, JSON.stringify(vector)
  );
  
  // Also sync to remote DB so other clients can search
  try {
    await upsertEmbeddingApi(stateId, vector);
  } catch (e) {
    console.warn('Failed to sync embedding to remote:', e);
  }
}

export async function getStateIdByUcode(ucode: string, scope = 'shop:main'): Promise<string | null> {
  const db = await getDb();
  const rows = await db.all(
    'SELECT id FROM state WHERE ucode = ? AND scope = ? LIMIT 1',
    ucode, scope
  );
  return rows.length > 0 ? (rows[0] as any).id : null;
}

export async function getStatesWithoutEmbeddings(scope = 'shop:main') {
  const db = await getDb();
  return db.all(
    `SELECT s.* FROM state s
     LEFT JOIN stateai e ON s.id = e.state_id
     WHERE s.scope = ? AND e.state_id IS NULL
     ORDER BY s.ts DESC`,
    scope
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
}

export async function searchStates(queryVector: number[], scope = 'shop:main', limit = 10) {
  const db = await getDb();
  try {
    // Native vector search using the dedicated embeddings table
    const rows = await db.all(
      `SELECT s.*, vector_distance_cos(e.embedding, vector32(?)) as distance
       FROM state s
       JOIN stateai e ON s.id = e.state_id
       WHERE s.scope = ?
       ORDER BY distance ASC
       LIMIT ?`,
      JSON.stringify(queryVector), scope, limit
    );
    return rows;
  } catch (e) {
    console.warn('Native vector search failed, falling back to JS:', e);
    // Fallback: read embeddings from the new table and compute in JS
    const allRows = await db.all(
      `SELECT s.*, e.embedding as raw_embedding FROM state s
       JOIN stateai e ON s.id = e.state_id
       WHERE s.scope = ?`,
      scope
    );

    const results = allRows.map((row: any) => {
      try {
        // raw_embedding may be a Float32Array or binary blob from F32_BLOB
        // Try to parse if it's a string, otherwise treat as array-like
        let embedding: number[];
        if (typeof row.raw_embedding === 'string') {
          embedding = JSON.parse(row.raw_embedding);
        } else if (row.raw_embedding && row.raw_embedding.length) {
          embedding = Array.from(row.raw_embedding);
        } else {
          return { ...row, distance: 999 };
        }
        return {
          ...row,
          distance: 1 - cosineSimilarity(queryVector, embedding)
        };
      } catch (parseErr) {
        return { ...row, distance: 999 };
      }
    });

    results.sort((a: any, b: any) => a.distance - b.distance);
    return results.slice(0, limit);
  }
}

// ─── Instance CRUD (working state under products/services) ───

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

export async function getInstancesByState(stateid: string, scope = 'shop:main'): Promise<Instance[]> {
  // Use direct API call - more reliable than sync engine for instances
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
  } catch (e: any) {
    console.error('[getInstancesByState] API failed:', e.message);
    // Fallback: try local DB
    try {
      const db = await getInstancesDb();
      const rows = await db.all(
        'SELECT id, stateid, type, scope, qty, value, currency, available, lat, lng, h3, startts, endts, ts, payload FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC',
        stateid, scope
      );
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
    } catch (fallbackErr) {
      console.error('[getInstancesByState] Local fallback also failed:', fallbackErr);
      return [];
    }
  }
}

// Simple UUID generator compatible with React Native
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Direct API instance creation - no local storage, faster and reliable
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
  console.log('[createInstance] START - data:', JSON.stringify(data));
  
  const id = generateUUID();
  console.log('[createInstance] Generated ID:', id);
  
  const scope = data.scope || 'shop:main';
  
  // Direct API call - no local storage delay
  console.log('[createInstance] Calling API...');
  try {
    const apiData = {
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
    };
    console.log('[createInstance] API payload:', JSON.stringify(apiData));
    
    const response = await createInstanceApi(apiData);
    console.log('[createInstance] API SUCCESS:', JSON.stringify(response));
    console.log('[createInstance] DONE - returning id:', id);
    return { success: true, id, remote: true };
  } catch (e: any) {
    console.error('[createInstance] API FAILED:', e.message);
    console.log('[createInstance] DONE with error - returning id:', id);
    return { success: false, id, error: e.message };
  }
}

// Local-first instance update
export async function updateInstance(id: string, data: any) {
  // Validate: check if there are fields to update
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
  
  // 2. API sync (skip push - libsql sync has issues with instances DB)
  try {
    await updateInstanceApi(id, data);
    console.log('Instance updated on remote via API');
  } catch (e) {
    console.warn('Instance update API sync failed:', e);
  }
  
  // 3. Pull to sync
  try {
    await pullInstancesData();
  } catch (e) {
    console.warn('Instance pull after update failed:', e);
  }
  
  return { success: true, id, local: true };
}

// Local-first instance delete
export async function deleteInstance(id: string) {
  // 1. Delete locally first
  const db = await getInstancesDb();
  await db.run('DELETE FROM instance WHERE id = ?', [id]);
  
  // 2. API sync (skip push - libsql sync has issues with instances DB)
  try {
    await deleteInstanceApi(id);
    console.log('Instance deleted on remote via API');
  } catch (e) {
    console.warn('Instance delete API sync failed:', e);
  }
  
  // 3. Pull to sync
  try {
    await pullInstancesData();
  } catch (e) {
    console.warn('Instance pull after delete failed:', e);
  }
  
  return { success: true, id, local: true };
}
