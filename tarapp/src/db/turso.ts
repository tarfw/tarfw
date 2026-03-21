import { connect, Database } from '@tursodatabase/sync-react-native';
import { createStateApi, updateStateApi, deleteStateApi, upsertEmbeddingApi } from '../api/client';

// ─── Two Database Connections ───

// States DB: state + stateai (long-term memory with vector embeddings)
const statesDbUrl = 'libsql://states-tarframework.aws-eu-west-1.turso.io';
const statesDbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwNzk5NzQsImlkIjoiMDE5ZDBmNTYtNDAwMS03YWExLThkNWQtOGY1YzkyZGFlMDc2IiwicmlkIjoiZDNmZjRhN2MtOThkZi00OTg3LWJjYjUtMjRlNGEwYTI3OWE1In0.HuH6t-vXlSuvnexhyqU-bEZffYQEPp8bITBD0hzi4Kcmb53XqvzBZUtz8QCjVO9HyOzB9ujnbDtB_maJN8-DAw';

// Instances DB: instance + trace (high-frequency working state & event ledger)
const instancesDbUrl = 'libsql://instances-tarframework.aws-eu-west-1.turso.io';
const instancesDbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwODAwODQsImlkIjoiMDE5ZDBmNTYtYTEwMS03OWE2LWJhYWMtY2Y4YjFiNGJjNDE3IiwicmlkIjoiMmNkM2U4OGItNGU0ZS00NTgzLWI1OGMtYzVjZGIzYjI3NzAyIn0.iUK00KHv6W3nnkJl3B3ELSI_62npG9T0U5wOSebthek2CNc-7wy7qPk4W40I_aBs20RWtBKOdG3s4zURnDQDCA';

// Database handles
let statesDbHandle: Database | null = null;
let instancesDbHandle: Database | null = null;
let embeddingsTableReady = false;
let instancesTablesReady = false;

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
    // instance table
    await db.run(`
      CREATE TABLE IF NOT EXISTS instance (
        id TEXT PRIMARY KEY,
        stateid TEXT NOT NULL,
        type TEXT,
        scope TEXT,
        qty REAL,
        value REAL,
        currency TEXT,
        available INTEGER,
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
