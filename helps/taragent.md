# TAR Agentic System — Working Memory

> **Purpose:** This document serves as the canonical reference for the `taragent` project. Use it for all future development, onboarding, and architectural decisions.

---

## 🎯 System Overview

**TAR Agentic System** is a **Universal Commerce OS** built on Cloudflare Workers with an event-driven architecture, semantic AI memory, and realtime collaboration capabilities.

### Core Properties
- **Event-driven** — All state changes flow through `trace` (event ledger)
- **Multi-tenant** — Scoped data isolation (`shop:ramstore`, `shop:annastore`)
- **Realtime** — WebSocket broadcast via Durable Objects
- **AI-native** — Semantic embeddings for search and intent detection
- **Scalable** — Designed for 10M+ users on Cloudflare edge

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Channels      │  (Telegram / Slack / App)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gateway Worker  │  (/api/channel, /api/state, /api/live)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Interpreter     │  (NLP → opcode → trace + instance)
│ Agent           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌───────────────────┐
│ Turso DB        │────▶│ Durable Objects   │
│ (trace+instance)│     │ (Order/Task/Conv) │
└─────────────────┘     └─────────┬─────────┘
                                  │
                                  ▼
                          WebSocket Broadcast
```

---

## 🗄️ Database Schema (Turso)

### `state` — Semantic Memory
Stores entities with embeddings for semantic search.

```sql
CREATE TABLE state (
  id TEXT PRIMARY KEY,
  ucode TEXT UNIQUE NOT NULL,      -- Format: {type}:{id} (e.g., product:apple)
  type TEXT NOT NULL,
  title TEXT,
  payload TEXT,                     -- JSON blob
  embedding BLOB,                   -- Vector for semantic search
  scope TEXT,                       -- Multi-tenant isolation
  author TEXT,
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### `instance` — Working State
Current projected state (quantities, locations, availability).

```sql
CREATE TABLE instance (
  id TEXT PRIMARY KEY,
  stateid TEXT NOT NULL,            -- FK → state(id)
  type TEXT,
  scope TEXT,
  qty REAL,                         -- Quantity on hand
  value REAL,                       -- Monetary value
  currency TEXT,
  available INTEGER,                -- Available qty
  lat REAL, lng REAL,               -- Geo coordinates
  h3 TEXT,                          -- H3 geohash
  startts TIMESTAMPTZ,              -- Valid from
  endts TIMESTAMPTZ,                -- Valid until
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  payload TEXT,                     -- JSON blob
  FOREIGN KEY (stateid) REFERENCES state(id)
);
```

### `trace` — Event Ledger
Immutable history of all state-changing events.

```sql
CREATE TABLE trace (
  id TEXT PRIMARY KEY,
  streamid TEXT NOT NULL,           -- Format: {type}:{id}
  opcode INTEGER NOT NULL,          -- Event type code
  status TEXT,                      -- e.g., "done", "pending"
  delta REAL,                       -- Change amount (for qty/value)
  lat REAL, lng REAL,
  payload TEXT,                     -- JSON event details
  ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  scope TEXT
);
```

### Required Indexes
```sql
CREATE INDEX idx_trace_stream_ts ON trace(streamid, ts);
CREATE INDEX idx_trace_scope ON trace(scope);
CREATE INDEX idx_instance_stateid ON instance(stateid);
CREATE INDEX idx_state_ucode ON state(ucode);
```

---

## 🔢 Opcode System

Opcodes are 3-digit codes that define event types. All state changes are driven by opcodes.

| Range | Domain      | Example Opcodes         |
|-------|-------------|-------------------------|
| 1xx   | Stock       | 101=Receive, 102=Sell   |
| 2xx   | Invoice     | 201=Create, 202=Pay     |
| 3xx   | Tasks       | 301=Schedule, 302=Complete |
| 4xx   | Accounts    | 401=Credit, 402=Debit   |
| 5xx   | Orders      | 501=Create, 502=Ship    |
| 6xx   | Transport   | 601=Dispatch, 605=GPS   |
| 7xx   | Tax         | 701=Calculate, 702=File |
| 8xx   | AI Memory   | 801=Embed, 802=Retrieve |
| 9xx   | Identity    | 901=Register, 902=Verify|

### Example Flow
```
User: "Sell 2 apples"
→ Interpreter detects intent
→ opcode: 102 (sell)
→ streamid: product:apple
→ delta: -2
→ trace written → instance updated
```

---

## 🤖 Agents

### 1. Gateway Worker (`src/index.ts`)
**Entry point** for all external requests.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/channel` | POST | Natural language + search requests |
| `/api/state` | POST/PUT/DELETE/GET | Direct state CRUD (app interface) |
| `/api/live/:scope` | GET | WebSocket live tracking |

### 2. Interpreter Agent (`src/agents/interpreter.ts`)
**Core brain** — transforms natural language into opcodes.

**Responsibilities:**
- Intent detection (uses Cloudflare AI)
- Opcode mapping
- Entity resolution (`state` lookup)
- Parameter extraction (qty, price, time, location)
- Write to `trace` + update `instance`
- Broadcast via Durable Objects

### 3. Search Agent (`src/agents/search.ts`)
**Semantic search** using vector embeddings.

**Use cases:**
- Product search ("find apples")
- CRM lookup ("find customer Ravi")
- Fuzzy matching via embedding similarity

### 4. Analytics Agent (`src/agents/analytics.ts`)
**Read-side processor** for reports and aggregations.

**Reads from:** `trace` table
**Generates:** Sales reports, inventory summaries, trend analysis

---

## 🧱 Durable Objects

Realtime collaboration and stateful sessions.

| DO Type | Purpose | Use Case |
|---------|---------|----------|
| `OrderDO` | Order lifecycle | Delivery tracking, restaurant→customer broadcast |
| `TaskDO` | Scheduled jobs | Alarms, cron-like tasks, reminders |
| `ConversationDO` | Chat groups | Multi-user conversations |
| `SessionDO` | Realtime collaboration | Co-editing, live cursors |

### Durable Object Responsibilities
- WebSocket connection management
- Realtime broadcast to subscribers
- Alarm scheduling (for Task DO)
- In-memory state caching

---

## 📡 Scheduling System (Task DO)

```
User: "Daily 8am report"
   ↓
Interpreter → opcode 301 (schedule)
   ↓
trace written
   ↓
Task DO created with alarm
   ↓
Alarm triggers at 8am
   ↓
Analytics Agent runs
   ↓
Gateway sends message to user
```

---

## 🌐 Realtime Delivery Flow

```
Driver app (GPS update)
   ↓
Gateway Worker
   ↓
Order DO (in-memory state)
   ↓
WebSocket broadcast
   ↓
Customer + Restaurant (live map)
```

**Note:** GPS coordinates are NOT stored in DB by default. Optional: `opcode 605` for trace logging.

---

## 🔐 Multi-tenant Scope Design

Use `scope` field in all tables for isolation.

| Example Scope | Meaning |
|---------------|---------|
| `shop:ramstore` | Ram's store tenant |
| `shop:annastore` | Anna's store tenant |
| `user:ravi` | User-scoped data |

**Best practice:** Always filter queries by `scope`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono (v4) |
| Database | Turso (libsql) |
| AI | Cloudflare AI (`@cf/baai/bge-base-en-v1.5`) |
| Language | TypeScript |
| Validation | Zod |
| Deployment | Wrangler |

---

## 📦 Project Structure

```
taragent/
├── src/
│   ├── index.ts              # Gateway Worker (HTTP + WebSocket)
│   ├── agents/
│   │   ├── interpreter.ts    # NLP → opcode pipeline
│   │   ├── search.ts         # Semantic search
│   │   └── analytics.ts      # Reports/aggregations
│   ├── db/
│   │   └── client.ts         # Turso client
│   ├── do/
│   │   ├── order.ts          # Order Durable Object
│   │   ├── task.ts           # Task Durable Object
│   │   └── stubs.ts          # Conversation + Session DO
│   └── scripts/              # Utility scripts
├── schema.sql                # Database schema
├── plan.md                   # Build plan
├── tests.md                  # Test specifications
├── package.json
├── tsconfig.json
├── wrangler.jsonc            # Cloudflare config
└── .dev.vars                 # Environment variables (dev)
```

---

## 🚀 Development Commands

```bash
# Start dev server
npm run dev        # wrangler dev

# Deploy to Cloudflare
npm run deploy     # wrangler deploy
```

---

## 📝 Key Design Decisions

1. **Event Sourcing** — `trace` is the source of truth; `instance` is a projection
2. **Semantic First** — All entities in `state` have embeddings for AI search
3. **Opcode-Driven** — No direct state mutation; all changes via opcodes
4. **Scope Everywhere** — Multi-tenancy enforced at query level
5. **Realtime via DO** — Durable Objects handle WebSocket fanout
6. **GPS Ephemeral** — Location data not persisted unless explicitly traced

---

## 🔮 Future Development Guidelines

When extending the system:

1. **New event types** → Add opcode in appropriate range (see Opcode System)
2. **New entity types** → Create `state` entry with embedding
3. **New realtime features** → Use existing DOs or create new DO type
4. **New integrations** → Add channel handler in Gateway Worker
5. **Performance** → Add indexes on `trace`/`instance` query patterns
6. **Security** → Always validate `scope` in queries

---

## 📚 Related Documents

| File | Purpose |
|------|---------|
| `plan.md` | Original build plan and architecture decisions |
| `schema.sql` | Authoritative database schema |
| `tests.md` | Test specifications and coverage |
| `smartintereptor.md` | Interpreter agent deep dive |

---

*Last updated: 2026-03-19*
*Version: 1.0 (Production-ready)*
