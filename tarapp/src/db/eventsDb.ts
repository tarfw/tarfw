import { Database, getDbPath } from '@tursodatabase/sync-react-native';

// ─── Local-Only Events DB (No Sync) ───
// This database stores task events locally only - no remote sync
// Used for creating task events that appear in workspace

let eventsDbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Initialize events DB schema (local-only, no sync)
async function initEventsSchema(db: Database) {
  const schema = [
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      due_date TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      payload TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      opcode INTEGER NOT NULL,
      delta REAL,
      payload TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
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

// ─── Get Local-Only Events DB (No Sync) ───
export async function getEventsDb(): Promise<Database> {
  if (eventsDbInstance) {
    console.log('[eventsDb] Returning cached DB instance');
    return eventsDbInstance;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Local-only: no url or authToken means no sync
    const dbPath = getDbPath('events.db');
    console.log('[eventsDb] Initializing local-only DB at:', dbPath);
    
    const instance = new Database({
      path: dbPath,
    });

    // Connect (local-only mode - no remote sync)
    await instance.connect();
    console.log('[eventsDb] Connected to local-only DB (no sync)');

    // Initialize schema
    await initEventsSchema(instance);
    console.log('[eventsDb] Schema initialized');

    eventsDbInstance = instance;
    console.log('[eventsDb] DB instance ready');
    return instance;
  })();

  return initPromise;
}

// Simple UUID generator compatible with React Native
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─── Task CRUD Operations (Local-Only) ───

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  payload?: string;
}

// Create a new task (local-only, generates TASKCREATE event)
export async function createTask(data: {
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  assigned_to?: string;
}): Promise<{ success: boolean; id?: string; task?: Task; error?: string }> {
  console.log('[eventsDb] Creating task:', { title: data.title, priority: data.priority, due_date: data.due_date });
  
  try {
    const db = await getEventsDb();
    const id = generateUUID();
    const now = new Date().toISOString();
    console.log('[eventsDb] Task ID:', id);

    // Insert task locally
    await db.run(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, assigned_to, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description || null,
        'pending',
        data.priority || 'normal',
        data.due_date || null,
        data.assigned_to || null,
        now,
        now,
        data.description ? JSON.stringify({ description: data.description }) : null
      ]
    );
    console.log('[eventsDb] Task inserted into local DB');

    // Create TASKCREATE event (opcode 301)
    const eventId = generateUUID();
    console.log('[eventsDb] Creating TASKCREATE event, opcode: 301, eventId:', eventId);
    
    await db.run(
      `INSERT INTO task_events (id, task_id, opcode, delta, payload, ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        id,
        301, // TASKCREATE opcode
        1,
        JSON.stringify({ title: data.title, priority: data.priority || 'normal' }),
        now
      ]
    );
    console.log('[eventsDb] TASKCREATE event logged (local-only, no sync)');

    // Fetch the created task
    const taskRow: any = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    console.log('[eventsDb] Task created successfully:', taskRow?.title);
    
    return {
      success: true,
      id,
      task: taskRow ? {
        id: String(taskRow.id),
        title: String(taskRow.title || ''),
        description: taskRow.description ? String(taskRow.description) : undefined,
        status: String(taskRow.status || 'pending') as Task['status'],
        priority: String(taskRow.priority || 'normal') as Task['priority'],
        due_date: taskRow.due_date ? String(taskRow.due_date) : undefined,
        assigned_to: taskRow.assigned_to ? String(taskRow.assigned_to) : undefined,
        created_at: taskRow.created_at ? String(taskRow.created_at) : undefined,
        updated_at: taskRow.updated_at ? String(taskRow.updated_at) : undefined,
        completed_at: taskRow.completed_at ? String(taskRow.completed_at) : undefined,
        payload: taskRow.payload ? String(taskRow.payload) : undefined,
      } : undefined
    };
  } catch (e: any) {
    console.error('[eventsDb] Failed to create task:', e.message);
    return { success: false, error: e.message };
  }
}

