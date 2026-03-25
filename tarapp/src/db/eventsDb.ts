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

// Get all tasks (local-only)
export async function getAllTasks(): Promise<Task[]> {
  console.log('[eventsDb] Fetching all tasks from local DB');
  
  try {
    const db = await getEventsDb();
    const rows: any[] = await db.all('SELECT * FROM tasks ORDER BY created_at DESC');
    console.log('[eventsDb] Found', rows.length, 'tasks');
    
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      description: row.description ? String(row.description) : undefined,
      status: String(row.status || 'pending') as Task['status'],
      priority: String(row.priority || 'normal') as Task['priority'],
      due_date: row.due_date ? String(row.due_date) : undefined,
      assigned_to: row.assigned_to ? String(row.assigned_to) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
      completed_at: row.completed_at ? String(row.completed_at) : undefined,
      payload: row.payload ? String(row.payload) : undefined,
    }));
  } catch (e: any) {
    console.error('[eventsDb] Failed to fetch tasks:', e.message);
    return [];
  }
}

// Get task by ID
export async function getTaskById(id: string): Promise<Task | null> {
  console.log('[eventsDb] Fetching task by ID:', id);
  
  try {
    const db = await getEventsDb();
    const row: any = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    
    if (!row) {
      console.log('[eventsDb] Task not found:', id);
      return null;
    }
    
    console.log('[eventsDb] Task found:', row.title);
    return {
      id: String(row.id),
      title: String(row.title || ''),
      description: row.description ? String(row.description) : undefined,
      status: String(row.status || 'pending') as Task['status'],
      priority: String(row.priority || 'normal') as Task['priority'],
      due_date: row.due_date ? String(row.due_date) : undefined,
      assigned_to: row.assigned_to ? String(row.assigned_to) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
      completed_at: row.completed_at ? String(row.completed_at) : undefined,
      payload: row.payload ? String(row.payload) : undefined,
    };
  } catch (e: any) {
    console.error('[eventsDb] Failed to fetch task by ID:', e.message);
    return null;
  }
}

// Update task status and create event
export async function updateTaskStatus(
  id: string, 
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  console.log('[eventsDb] Updating task status:', { id, status });
  
  // Map status to opcode
  const opcodeMap: Record<string, number> = {
    'in_progress': 303, // TASKSTART
    'done': 305, // TASKDONE
    'blocked': 307, // TASKBLOCK
    'cancelled': 309, // TASKVOID
    'pending': 308, // TASKRESUME
  };
  
  try {
    const db = await getEventsDb();
    const now = new Date().toISOString();
    const completedAt = status === 'done' ? now : null;

    // Update task
    await db.run(
      'UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?',
      [status, now, completedAt, id]
    );
    console.log('[eventsDb] Task status updated to:', status);

    // Create status change event
    const eventId = generateUUID();
    const opcode = opcodeMap[status] || 304; // Default to TASKPROGRESS
    console.log('[eventsDb] Creating status change event, opcode:', opcode);
    
    await db.run(
      `INSERT INTO task_events (id, task_id, opcode, delta, payload, ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        id,
        opcode,
        status === 'done' ? -1 : 1,
        JSON.stringify({ status }),
        now
      ]
    );
    console.log('[eventsDb] Status change event logged (local-only)');

    return { success: true };
  } catch (e: any) {
    console.error('[eventsDb] Failed to update task status:', e.message);
    return { success: false, error: e.message };
  }
}

// Delete task (local-only)
export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
  console.log('[eventsDb] Deleting task:', id);
  
  try {
    const db = await getEventsDb();
    const now = new Date().toISOString();

    // Create TASKVOID event before deleting
    const eventId = generateUUID();
    console.log('[eventsDb] Creating TASKVOID event before delete, eventId:', eventId);
    
    await db.run(
      `INSERT INTO task_events (id, task_id, opcode, delta, payload, ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        id,
        309, // TASKVOID opcode
        -1,
        JSON.stringify({ action: 'delete' }),
        now
      ]
    );

    // Delete task events first
    await db.run('DELETE FROM task_events WHERE task_id = ?', [id]);
    console.log('[eventsDb] Task events deleted');
    
    // Delete task
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    console.log('[eventsDb] Task deleted (local-only, no sync)');

    return { success: true };
  } catch (e: any) {
    console.error('[eventsDb] Failed to delete task:', e.message);
    return { success: false, error: e.message };
  }
}

// Get recent task events for workspace
export async function getRecentTaskEvents(limit = 50): Promise<any[]> {
  console.log('[eventsDb] Fetching recent task events, limit:', limit);
  
  try {
    const db = await getEventsDb();
    const rows = await db.all(
      'SELECT * FROM task_events ORDER BY ts DESC LIMIT ?',
      [limit]
    );
    console.log('[eventsDb] Found', rows.length, 'task events');
    return rows;
  } catch (e: any) {
    console.error('[eventsDb] Failed to fetch task events:', e.message);
    return [];
  }
}