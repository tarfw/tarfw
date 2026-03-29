# TAR Framework — WebSocket, SQLite & Worker Architecture

## WebSocket Flow

| Step | Who | What happens | File |
|------|-----|-------------|------|
| 1 | Workspace screen | Calls `useLiveEvents()` hook on mount | `tarapp/src/screens/workspace.tsx:126` |
| 2 | useLiveEvents hook | Opens WS to `wss://taragent.wetarteam.workers.dev/api/ws/shop:main` with auth token | `tarapp/hooks/useLiveEvents.ts:103-109` |
| 3 | Worker (Hono) | Route `/api/ws/:scope` receives upgrade, forwards to OrderDO by scope name | `taragent/src/index.ts:484-509` |
| 4 | OrderDO | Accepts WebSocket with `ctx.acceptWebSocket(server)`, returns 101 | `taragent/src/do/order.ts:111-122` |
| 5 | On WS open | Hook calls `GET /api/events/shop:main` to load event history | `tarapp/hooks/useLiveEvents.ts:116` |
| 6 | On WS message | Hook parses JSON, micro-batches (300ms), deduplicates by ID, updates state | `tarapp/hooks/useLiveEvents.ts:119-141` |
| 7 | OrderDO broadcast | On POST or WS message — saves to SQLite, broadcasts to ALL connected sockets | `taragent/src/do/order.ts:164-179, 269-320` |
| 8 | Reconnect | On close — exponential backoff 1s to 30s max, auto-reconnects | `tarapp/hooks/useLiveEvents.ts:144-153` |

## SQLite / Database Architecture

| Database | Location | Tech | Sync | Used by |
|----------|----------|------|------|---------|
| `instances.db` | Mobile (local) | `@tursodatabase/sync-react-native` | Turso bi-directional (`push/pull`) to `instances-tarframework.turso.io` | `tarapp/src/db/turso.ts` — Instance CRUD, OrderScreen reads items |
| `events.db` | Mobile (local) | `@tursodatabase/sync-react-native` | No sync (local-only) | `tarapp/src/db/eventsDb.ts` — Tasks CRUD, local task events |
| `cloud_events` | Worker (OrderDO) | CF Durable Object SQLite (`ctx.storage.sql`) | N/A (lives on edge) | `taragent/src/do/order.ts` — Persists cloud events, serves history via REST |
| `state` | Remote (Turso) | `@libsql/client` | Remote-only (HTTP API) | `taragent/src/index.ts` — State CRUD, vector search |
| `stateai` | Remote (Turso) | `@libsql/client` | Remote-only (HTTP API) | `taragent/src/index.ts` — Embedding storage (384-dim MiniLM vectors) |
| `auth tables` | Worker (SessionDO) | CF Durable Object SQLite | N/A (lives on edge) | `taragent/src/do/session.ts` — Users, sessions, scopes |

## OrderScreen Flow (Place Order)

| Step | Who | What happens | File |
|------|-----|-------------|------|
| 1 | OrderScreen | Calls `getAllInstances('shop:main')` to load items from local SQLite | `tarapp/components/OrderScreen.tsx:43` → `turso.ts:156` |
| 2 | turso.ts | Reads from local `instances.db` (local-first), falls back to API | `tarapp/src/db/turso.ts:158-218` |
| 3 | User taps Place Order | Closes modal immediately, captures line items | `tarapp/components/OrderScreen.tsx:84-88` |
| 4 | Background async | POSTs `pushCloudEventApi()` with opcode 501 (ORDERCREATE) | `tarapp/components/OrderScreen.tsx:114-120` |
| 5 | client.ts | POSTs to `POST /api/event` on the worker | `tarapp/src/api/client.ts:216-228` |
| 6 | Worker | Routes to OrderDO — saves to SQLite + broadcasts to all WS clients | `taragent/src/index.ts:522-582` → `order.ts:143-183` |
| 7 | Then | Pushes STOCKADJUST (opcode 104) events per line item (negative delta) | `tarapp/components/OrderScreen.tsx:121-131` |
| 8 | Workspace | Receives broadcast via WebSocket, shows order + stock adjustments live | `tarapp/hooks/useLiveEvents.ts:134-138` |

## Worker (`taragent`) Components

| Component | Type | Role |
|-----------|------|------|
| Hono app | CF Worker | API router — state CRUD, instance CRUD, search, auth, event push, WS proxy |
| OrderDO | Durable Object | WebSocket hub + cloud event persistence (SQLite) + broadcast |
| SessionDO | Durable Object | Auth — Google sign-in, session tokens, scope management (SQLite) |
| TaskDO | Durable Object | Task management |
| InterpreterAgent | Agent class | Natural language to opcode intent processing |
| SearchAgent | Agent class | Server-side vector search via Turso stateai table |

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ws/:scope` | WebSocket upgrade — proxied to OrderDO |
| POST | `/api/event` | Push a single cloud event — saved + broadcast via OrderDO |
| GET | `/api/events/:scope` | Fetch recent persisted events from OrderDO SQLite |
| DELETE | `/api/events/:scope?id=` | Delete event by ID — broadcasts delete to WS clients |
| PUT | `/api/events/:scope?id=` | Update event by ID — broadcasts update to WS clients |
| POST | `/api/state` | Create state (remote Turso) |
| GET | `/api/states` | List all states |
| POST | `/api/instance` | Create instance (remote Turso instances DB) |
| POST | `/api/search` | Vector search (mobile sends 384-dim query vector) |
| POST | `/api/channel` | Natural language intent — routes to InterpreterAgent or SearchAgent |
| POST | `/api/auth/google` | Google sign-in — proxied to SessionDO |
