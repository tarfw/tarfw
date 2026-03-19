### TAR Agentic System — Final Build Plan (for Coding Agent)

---

# 1️⃣ Goal

Build a **Universal Commerce OS** using:

- Cloudflare Workers + Durable Objects
- Turso (single DB)
- Event-driven opcode system

---

# 2️⃣ Database Schema (Turso)

## state (semantic memory)

```sql
CREATE TABLE state (
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
```

---

## instance (working state)

```sql
CREATE TABLE instance (
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
```

---

## trace (event ledger)

```sql
CREATE TABLE trace (
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
```

---

## Indexes (must)

```sql
CREATE INDEX idx_trace_stream_ts ON trace(streamid, ts);
CREATE INDEX idx_trace_scope ON trace(scope);
CREATE INDEX idx_instance_stateid ON instance(stateid);
CREATE INDEX idx_state_ucode ON state(ucode);
```

---

# 3️⃣ Core Architecture

```text
Channels
(Telegram / App)
        ↓
Gateway Worker
        ↓
Interpreter Agent
        ↓
Trace + Instance (Turso)
        ↓
Durable Objects (realtime)
```

---

# 4️⃣ Workers (Agents)

## 4.1 Gateway Worker

- endpoint: `/api/channel`
- receives Telegram / Slack / app requests
- forwards to Interpreter

---

## 4.2 Interpreter Agent (MAIN LOGIC)

Responsibilities:

- detect intent (semantic model)
- map → opcode
- resolve entity (`state`)
- extract params (qty, price, time)
- write to `trace`
- update `instance`

Example:

```text
"received 2 apples"
→ opcode 101
→ delta +2
→ streamid product:apple
```

---

## 4.3 Search Agent

- semantic search on `state.embedding`
- used for:
  - product search
  - CRM lookup

---

## 4.4 Analytics Agent

- reads `trace`
- generates:
  - reports
  - aggregations

---

# 5️⃣ Durable Objects

## Types

| DO              | Purpose                |
| --------------- | ---------------------- |
| Conversation DO | chat groups            |
| Order DO        | delivery / transaction |
| Task DO         | scheduled jobs         |
| Session DO      | realtime collaboration |

---

## Responsibilities

- WebSocket handling
- realtime broadcast
- alarms (scheduler)

---

# 6️⃣ Scheduling System

Flow:

```text
User → "daily 8am report"
   ↓
Interpreter → opcode 301
   ↓
trace written
   ↓
Task DO created
   ↓
DO alarm set
   ↓
Alarm triggers
   ↓
Analytics Agent
   ↓
Gateway sends message
```

---

# 7️⃣ Realtime Delivery Flow

```text
Driver app
   ↓
Gateway Worker
   ↓
Order DO
   ↓
WebSocket broadcast
   ↓
Customer / restaurant
```

- GPS NOT stored in DB
- Optional trace: opcode 605

---

# 8️⃣ Stream Design

Format:

```text
{type}:{id}
```

Examples:

| Entity  | streamid      |
| ------- | ------------- |
| product | product:apple |
| order   | order:1001    |
| user    | user:ravi     |

---

# 9️⃣ Opcode System

| Range | Domain    |
| ----- | --------- |
| 1xx   | stock     |
| 2xx   | invoice   |
| 3xx   | tasks     |
| 4xx   | accounts  |
| 5xx   | orders    |
| 6xx   | transport |
| 7xx   | tax       |
| 8xx   | AI memory |
| 9xx   | identity  |

---

# 🔟 Example Flow

### Input

```text
Sell 2 apples
```

### Output

```json
trace:
opcode:102
delta:-2
streamid:"product:apple"
status:"done"
```

```text
instance:
qty reduced
```

---

# 11️⃣ Collaboration Model

| Concept  | Role                   |
| -------- | ---------------------- |
| trace    | history                |
| instance | current state          |
| DO       | realtime collaboration |

---

# 12️⃣ Scope (Multi-tenant)

Use `scope` everywhere:

| Example        |
| -------------- |
| shop:ramstore  |
| shop:annastore |

---

# 13️⃣ Final System Properties

- event-driven
- multi-tenant
- realtime
- AI-native
- scalable (10M+ users)

---

# 14️⃣ Build Order (Important)

1. Create DB schema
2. Build Gateway Worker
3. Build Interpreter (core)
4. Implement trace + instance writes
5. Add semantic search
6. Add Durable Objects (order + task)
7. Add WebSockets
8. Add scheduler (DO alarms)
9. Add analytics

---

# ✅ Final Summary

```text
TAR =
Event Engine (trace)
+ State Projection (instance)
+ Semantic Memory (state)
+ Realtime Layer (DO)
```

---

This is your **production-ready instruction plan** for the coding agent.
