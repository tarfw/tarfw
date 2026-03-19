import { connect, Database } from '@tursodatabase/sync-react-native';

const dbUrl = 'libsql://taragent-tarframework.aws-eu-west-1.turso.io';
const dbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzM3NDE3NzUsImlkIjoiMDE5Y2ZiM2YtMzkwMS03NTBkLTlkNmQtODZhMWU0MGU0ZThhIiwicmlkIjoiMjZkODVjMGQtNDM4OC00ZTlkLTk1ZjYtNzNkNzdmMGM5NDQ4In0.Uj72uqB8_mWlQokEVaZpVsCjGKgD91wBoKamcBIATuUSzMuD2R2ZzxTq7elTHfMeuBCGzFv1xzc0VWXqzAF9CA';

let dbHandle: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbHandle) {
    dbHandle = await connect({
      path: 'taragent.db',
      url: dbUrl,
      authToken: dbToken,
    });
    // Optional: initial pull to get remote data
    try {
      await dbHandle.pull();
    } catch (e: any) {
      console.warn('Initial Turso pull failed:', e);
    }
  }
  return dbHandle;
}

export async function pullData() {
  const db = await getDb();
  await db.pull();
}

export async function pushData() {
  const db = await getDb();
  await db.push();
}

/**
 * State CRUD operations using the local DB.
 */
export async function getAllStates(scope = 'shop:main') {
  const db = await getDb();
  const rows = await db.all(
    'SELECT * FROM state WHERE scope = ? ORDER BY ts DESC',
    scope
  );
  return rows;
}

export async function createStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main', embedding?: number[]) {
  const db = await getDb();
  const [type] = ucode.split(':');
  const id = Math.random().toString(36).substring(2, 11);
  
  await db.run(
    'INSERT INTO state (id, ucode, type, title, payload, scope, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, ucode, type || 'unknown', title || null, JSON.stringify(payload || {}), scope, embedding ? JSON.stringify(embedding) : null
  );
  
  // Try to push changes, but don't block
  db.push().catch((e: any) => console.error('Push failed after create:', e));
}

export async function updateStateLocal(ucode: string, title: string | undefined, payload: any, scope = 'shop:main', embedding?: number[]) {
  const db = await getDb();
  await db.run(
    'UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload), embedding = COALESCE(?, embedding) WHERE ucode = ? AND scope = ?',
    title || null, payload ? JSON.stringify(payload) : null, embedding ? JSON.stringify(embedding) : null, ucode, scope
  );
  
  db.push().catch((e: any) => console.error('Push failed after update:', e));
}

export async function deleteStateLocal(ucode: string, scope = 'shop:main') {
  const db = await getDb();
  await db.run(
    'DELETE FROM state WHERE ucode = ? AND scope = ?',
    ucode, scope
  );
  
  db.push().catch((e: any) => console.error('Push failed after delete:', e));
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
    // Try native vector search first
    // Note: older versions used vector_distance, newer use vector_distance_cos
    const rows = await db.all(
      `SELECT *, vector_distance_cos(embedding, ?) as distance 
       FROM state 
       WHERE scope = ? AND embedding IS NOT NULL
       ORDER BY distance ASC 
       LIMIT ?`,
      JSON.stringify(queryVector), scope, limit
    );
    return rows;
  } catch (e) {
    console.warn('Native vector search failed, falling back to JS:', e);
    // Fallback: Fetch all with embeddings and sort in JS
    const allRows = await db.all(
      'SELECT * FROM state WHERE scope = ? AND embedding IS NOT NULL',
      scope
    );
    
    const results = allRows.map(row => {
      try {
        if (typeof row.embedding !== 'string') {
          return { ...row, distance: 999 };
        }
        const embedding = JSON.parse(row.embedding);
        return {
          ...row,
          distance: 1 - cosineSimilarity(queryVector, embedding)
        };
      } catch (parseErr) {
        return { ...row, distance: 999 };
      }
    });
    
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }
}
