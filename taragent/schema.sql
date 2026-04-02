-- Database Schema (Turso) for Universal Commerce OS

-- 1. state (semantic memory)
CREATE TABLE IF NOT EXISTS state (
  id TEXT PRIMARY KEY,
  ucode TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  payload TEXT,
  embedding BLOB,
  scope TEXT,
  userid TEXT,
  public INTEGER DEFAULT 0,
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. instance (working state)
-- Note: stateid references state.ucode, NOT state.id (state is in states DB, instance is in instances DB)
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
  startts TIMESTAMPTZ,
  endts TIMESTAMPTZ,
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  payload TEXT
);

-- 3. events (event ledger) - renamed from trace
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  streamid TEXT NOT NULL,
  opcode INTEGER NOT NULL,
  status TEXT,
  delta REAL,
  lat REAL,
  lng REAL,
  payload TEXT,
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  scope TEXT
);

-- 4. stateai (vector search)
-- Note: state_id references state.id (both in states DB)
CREATE TABLE IF NOT EXISTS stateai (
  state_id TEXT PRIMARY KEY,
  embedding F32_BLOB(384)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_stream_ts ON events(streamid, ts);
CREATE INDEX IF NOT EXISTS idx_events_scope ON events(scope);
CREATE INDEX IF NOT EXISTS idx_instance_stateid ON instance(stateid);
CREATE INDEX IF NOT EXISTS idx_state_ucode ON state(ucode);
CREATE INDEX IF NOT EXISTS idx_state_public ON state(public, type);
