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
  author TEXT,
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. instance (working state)
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
  payload TEXT,
  FOREIGN KEY (stateid) REFERENCES state(id)
);

-- 3. trace (event ledger)
CREATE TABLE IF NOT EXISTS trace (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trace_stream_ts ON trace(streamid, ts);
CREATE INDEX IF NOT EXISTS idx_trace_scope ON trace(scope);
CREATE INDEX IF NOT EXISTS idx_instance_stateid ON instance(stateid);
CREATE INDEX IF NOT EXISTS idx_state_ucode ON state(ucode);
