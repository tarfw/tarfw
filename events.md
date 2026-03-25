# TAR Events System Documentation

> This document covers the complete event architecture for the TAR (Task/Agent/Relay) system. It explains how events flow between the mobile app and Cloudflare Workers backend, how they're persisted, and the opcode system used throughout.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Event Sources](#event-sources)
3. [Opcode Reference](#opcode-reference)
4. [Local Events (Mobile App)](#local-events-mobile-app)
5. [Cloud Events (Backend)](#cloud-events-backend)
6. [WebSocket Live Streaming](#websocket-live-streaming)
7. [API Endpoints](#api-endpoints)
8. [Deduplication Strategy](#deduplication-strategy)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TAR APP (Mobile)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │  AddMemories │    │  useLive     │    │  Workspace   │                 │
│  │  (Tasks)     │───▶│  Events Hook │───▶│  (Display)   │                 │
│  └──────────────┘    └──────────────┘    └──────────────┘                 │
│         │                   │                                              │
│         ▼                   ▼                                              │
│  ┌──────────────┐    ┌──────────────┐                                     │
│  │  events.db   │    │  WebSocket   │──────────────┐                      │
│  │  (Turso local│    │  Connection  │              │                      │
│  │   SQLite)    │    └──────────────┘              │                      │
│  └──────────────┘                                   │                      │
└─────────────────────────────────────────────────────│──────────────────────┘
                                                      │
                          ┌───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TARAGENT (Cloudflare Workers)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Durable Object (OrderDO)                       │   │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    │   │
│  │  │  WebSocket     │    │  SQLite        │    │  Event         │    │   │
│  │  │  Handler       │    │  Persistence   │    │  Deduplication │    │   │
│  │  └────────────────┘    └────────────────┘    └────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────┐    ┌──────────────────┐                             │
│  │  POST /api/event │    │  GET /api/events │                             │
│  │  (Emit events)   │    │  (Fetch events)  │                             │
│  └──────────────────┘    └──────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Sources

The system handles two types of events:

### 1. Local Events (Mobile)
- **Source**: `events.db` (Turso SQLite - local only, no sync)
- **Storage**: Mobile device's local database
- **Use Case**: Task creation, local operations that don't need cloud sync
- **Displayed in Workspace**: Light green background (`#E8F5E9`)

### 2. Cloud Events (Backend)
- **Source**: Cloudflare Durable Object SQLite
- **Storage**: DO's persistent storage
- **Use Case**: Inventory changes, orders, payments, multi-device sync
- **Displayed in Workspace**: Default white background

---

## Opcode Reference

The event system uses a 3-digit opcode system to categorize events:

### 📦 Inventory Operations (100-199)

| Opcode | Name | Description |
|--------|------|-------------|
| 101 | STOCKIN | Stock received into inventory |
| 102 | SALEOUT | Item sold (quantity decrease) |
| 103 | SALERETURN | Customer returned item |
| 104 | STOCKADJUST | Manual inventory correction |
| 105 | TRANSFEROUT | Stock transferred to another location |
| 106 | TRANSFERIN | Stock received from transfer |
| 107 | STOCKVOID | Inventory operation cancelled |

### 💰 Invoice & Payments (200-299)

| Opcode | Name | Description |
|--------|------|-------------|
| 201 | INVOICECREATE | New invoice created |
| 202 | ITEMADD | Item added to invoice |
| 203 | INVOICEPAYMENT | Invoice payment received |
| 204 | PAYMENTFAIL | Payment failed |
| 205 | INVOICEVOID | Invoice cancelled |
| 206 | ITEMDEFINE | New item defined |
| 207 | INVOICEREFUND | Full or partial refund |

### ✅ Task Management (300-399)

| Opcode | Name | Description |
|--------|------|-------------|
| 301 | TASKCREATE | New task created |
| 302 | TASKASSIGN | Task assigned to user |
| 303 | TASKSTART | Task work started |
| 304 | TASKPROGRESS | Task progress updated |
| 305 | TASKDONE | Task completed |
| 306 | TASKFAIL | Task failed/blocked |
| 307 | TASKBLOCK | Task blocked |
| 308 | TASKRESUME | Task resumed |
| 309 | TASKVOID | Task cancelled |
| 310 | TASKLINK | Tasks linked together |
| 311 | TASKCOMMENT | Comment added to task |

### 💵 Financial Transactions (400-499)

| Opcode | Name | Description |
|--------|------|-------------|
| 401 | PAYIN | Money received |
| 402 | PAYOUT | Money paid out |
| 403 | ACCOUNTREFUND | Account refund issued |
| 404 | ACCOUNTADJUST | Manual account adjustment |

### 📦 Orders & Fulfillment (500-599)

| Opcode | Name | Description |
|--------|------|-------------|
| 501 | ORDERCREATE | New order created |
| 502 | ORDERSHIP | Order shipped |
| 503 | ORDERDELIVER | Order delivered |
| 504 | ORDERCANCEL | Order cancelled |

### 🚗 Ride/Rental/Booking (600-699)

| Opcode | Name | Description |
|--------|------|-------------|
| 601 | RIDECREATE | Ride booking created |
| 602 | RIDESTART | Ride started |
| 603 | RIDEDONE | Ride completed |
| 604 | RIDECANCEL | Ride cancelled |
| 605 | MOTION | Location/movement update |
| 611 | BOOKINGCREATE | Reservation created |
| 612 | BOOKINGDONE | Reservation completed |
| 621 | RENTALSTART | Rental period started |
| 622 | RENTALEND | Rental period ended |

### 📊 Tax & Accounting (700-799)

| Opcode | Name | Description |
|--------|------|-------------|
| 701 | GSTACCRUE | GST liability accrued |
| 702 | GSTPAY | GST payment made |
| 703 | GSTREFUND | GST refund received |

### 🧠 Memory/State (800-899)

| Opcode | Name | Description |
|--------|------|-------------|
| 801 | MEMORYDEFINE | New state/memory defined |
| 802 | MEMORYWRITE | State data written |

### 👤 User & Access (900-999)

| Opcode | Name | Description |
|--------|------|-------------|
| 901 | USERCREATE | User account created |
| 902 | ROLEGRANT | Permission/role assigned |

---

## Local Events (Mobile App)

### Database Schema

The mobile app uses a local-only SQLite database (`events.db`) via Turso:

```typescript
// Location: tarapp/src/db/eventsDb.ts

// Tables created:
- tasks: Local task storage
- task_events: Event log for tasks
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `createTask()` | Create task & log TASKCREATE event (opcode 301) |
| `updateTaskStatus()` | Update status & log corresponding event |
| `getRecentTaskEvents()` | Fetch events for Workspace display |
| `deleteTask()` | Delete task & log TASKVOID event (opcode 309) |

### Event Interface (TypeScript)

```typescript
interface LiveEvent {
  id?: string;           // Unique event ID
  opcode: number;        // Event type (301-311 for tasks)
  delta: number;         // Numeric change (+1, -1, etc)
  streamid: string;      // Entity ID (e.g., task ID)
  title?: string;        // Task title (for display)
  status: string;        // 'local' or 'cloud'
  timestamp: string;     // Formatted time string
  source: 'local' | 'cloud';
}
```

---

## Cloud Events (Backend)

### Storage: Durable Object SQLite

Events are persisted in the `OrderDO` Durable Object's SQLite storage:

```sql
-- Schema in taragent/src/do/order.ts

CREATE TABLE IF NOT EXISTS cloud_events (
  id TEXT PRIMARY KEY,
  opcode INTEGER NOT NULL,
  streamid TEXT NOT NULL,
  delta REAL DEFAULT 0,
  payload TEXT,
  scope TEXT NOT NULL,
  source TEXT DEFAULT 'cloud',
  ts TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_events_scope ON cloud_events(scope);
CREATE INDEX idx_events_ts ON cloud_events(ts DESC);
CREATE INDEX idx_events_opcode ON cloud_events(opcode);
CREATE INDEX idx_events_composite ON cloud_events(opcode, streamid, ts);
```

### Key Methods (OrderDO)

| Method | Purpose |
|--------|---------|
| `saveCloudEvent()` | Persist event to DO SQLite |
| `getRecentEvents()` | Fetch events by scope |
| `eventExists()` | Check for duplicates |

### SQLite API Usage (Corrected)

The DO uses the Cloudflare SQLite-backed storage API. Key points:

```typescript
// exec(query, ...bindings) returns a cursor
const cursor = db.exec(
  `SELECT * FROM cloud_events WHERE scope = ? ORDER BY ts DESC LIMIT ?`,
  scope, limit
);

// Use .toArray() for multiple rows
const rows = cursor.toArray();

// Use .one() for single row (throws if 0 or >1 rows)
const row = cursor.one();

// Use .next() for iteration
const result = cursor.next();
if (!result.done) {
  console.log(result.value); // row object
}
```

**Important:** Always use parameter bindings (`?`) instead of string interpolation to prevent SQL injection and ensure proper escaping.

---

## WebSocket Live Streaming

### Connection URL

```
wss://taragent.wetarteam.workers.dev/api/live/{scope}
```

Example: `wss://taragent.wetarteam.workers.dev/api/live/shop:main`

### How It Works

1. **Mobile connects** to WebSocket endpoint
2. **OrderDO accepts** the WebSocket connection
3. **Events flow in two ways**:
   - **HTTP POST** to `/api/event` → broadcasts to all WS clients
   - **Direct WS message** → broadcasts to other clients
4. **Both paths** trigger persistence to DO SQLite

### Auto-Reconnection

The `useLiveEvents` hook handles reconnection automatically:

```typescript
ws.current.onclose = () => {
  setStatus('Reconnecting...');
  setTimeout(connectWebSocket, 3000); // Retry after 3 seconds
};
```

---

## API Endpoints

### POST /api/event
Emit a sample event (for testing).

**Request:**
```json
{
  "opcode": 301,
  "streamid": "task-123",
  "delta": 1,
  "payload": { "title": "My Task", "priority": "high" },
  "scope": "shop:main"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "emitted": true,
    "event": { ... },
    "scope": "shop:main"
  }
}
```

### GET /api/events/:scope
Fetch persisted cloud events from DO SQLite.

**Parameters:**
- `scope` (path): Store scope (e.g., "shop:main")
- `limit` (query): Max events to return (default: 50)

**Response:**
```json
{
  "success": true,
  "result": [
    {
      "id": "uuid",
      "opcode": 301,
      "streamid": "task-123",
      "delta": 1,
      "payload": { "title": "My Task" },
      "source": "cloud",
      "scope": "shop:main",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### GET /api/live/:scope
WebSocket upgrade endpoint for real-time event streaming.

---

## Deduplication Strategy

To prevent duplicate events when:
- Events come via both HTTP POST and WebSocket
- Events are loaded on app mount AND received in real-time

### Implementation

```typescript
// Check for existing event within 5-second window
async function eventExists(
  opcode: number, 
  streamid: string, 
  scope: string, 
  timeWindowSeconds = 5
): Promise<boolean> {
  const result = await db.execute(
    `SELECT 1 FROM cloud_events 
     WHERE opcode = ? AND streamid = ? AND scope = ? 
     AND ts >= datetime('now', '-${timeWindowSeconds} seconds')
     LIMIT 1`,
    [opcode, streamid, scope]
  );
  return result.rows.length > 0;
}
```

### Client-Side Deduplication

The mobile app also deduplicates using event IDs:

```typescript
setEvents((prev) => {
  const existingIds = new Set(prev.map(e => e.id).filter(Boolean));
  const newOnly = cloudEvents.filter(e => e.id && !existingIds.has(e.id));
  return [...newOnly, ...prev].slice(0, 50);
});
```

---

## Workspace Display

The `Workspace` screen (`tarapp/src/screens/workspace.tsx`) displays events with:

- **Color-coded opcodes** - Each opcode range has a distinct color
- **Task title display** - For task events (301-311), shows title instead of streamid
- **Visual distinction** - Local events have light green background
- **Delta indicator** - Shows + or - for numeric changes
- **Timestamp** - Localized time string

---

## Multi-Store Support (Future)

Currently, `scope` defaults to `shop:main`. For multi-store support:

1. **Scope parameter** already exists in all APIs
2. **DO uses** `idFromName(scope)` to create separate DO instances per store
3. **Auth layer needed** to map users to their authorized scopes

---

## Related Files

### Mobile App (tarapp)

| File | Purpose |
|------|---------|
| `src/screens/workspace.tsx` | Event display UI with opcode metadata |
| `hooks/useLiveEvents.ts` | WebSocket connection & event loading |
| `src/db/eventsDb.ts` | Local event storage (tasks) |
| `src/api/client.ts` | API client for cloud event fetching |
| `components/addmemories.tsx` | Task creation form |

### Backend (taragent)

| File | Purpose |
|------|---------|
| `src/do/order.ts` | Durable Object with SQLite persistence |
| `src/index.ts` | API routes & WebSocket handling |
| `wrangler.jsonc` | DO namespace configuration |

---

*Last Updated: Generated from codebase review*