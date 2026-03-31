# TarAgent Tools Reference

## AI Chat Tools (24 tools)

Used by the LLM inside `onChatMessage` via AI SDK `streamText`.

| # | Tool | Category | Description | Key Params |
|---|------|----------|-------------|------------|
| 1 | `createState` | State CRUD | Create a new state record (product, service, etc.) | `ucode`, `title?`, `payload?`, `scope` |
| 2 | `updateState` | State CRUD | Update an existing state record | `ucode`, `title?`, `payload?`, `scope` |
| 3 | `deleteState` | State CRUD | Delete a state record by ucode | `ucode`, `scope` |
| 4 | `getState` | State CRUD | Get a single state record by ucode | `ucode`, `scope` |
| 5 | `listStates` | State CRUD | List state records, optionally filtered by type | `scope`, `type?`, `limit` |
| 6 | `createInstance` | Instance CRUD | Create a new instance (inventory item, working state) | `stateid`, `type`, `scope`, `qty?`, `value?`, `currency`, `available`, `payload?` |
| 7 | `getInstances` | Instance CRUD | Get instances by stateid | `stateid`, `scope` |
| 8 | `updateInstance` | Instance CRUD | Update an instance by ID | `id`, `qty?`, `value?`, `available?`, `payload?` |
| 9 | `deleteInstance` | Instance CRUD | Delete an instance by ID | `id` |
| 10 | `upsertEmbedding` | Search | Store an embedding vector (384-dim) for a state | `stateId`, `vector` |
| 11 | `searchEmbeddings` | Search | Semantic search using a query vector | `vector`, `scope`, `limit` |
| 12 | `emitEvent` | Events | Emit a cloud event to OrderDO for persistence and broadcast | `opcode`, `streamid`, `delta`, `payload?`, `scope` |
| 13 | `getEvents` | Events | Get recent events for a scope | `scope`, `limit` |
| 14 | `deleteEvent` | Events | Delete an event by ID | `eventId`, `scope` |
| 15 | `updateEvent` | Events | Update an event by ID | `eventId`, `scope`, `opcode?`, `streamid?`, `delta?`, `payload?` |
| 16 | `generateDesign` | Design | Generate a storefront design for a scope | `text`, `scope`, `userId` |
| 17 | `updateDesign` | Design | Update an existing storefront design | `text`, `scope`, `userId` |
| 18 | `getDesignHistory` | Design | Get design snapshot history for a scope | `scope`, `limit` |
| 19 | `revertDesign` | Design | Revert storefront design to a previous snapshot | `eventId`, `scope` |
| 20 | `interpretIntent` | NL Intent | Interpret natural language into a TAR opcode operation | `text`, `scope`, `userId` |
| 21 | `generateReport` | Analytics | Generate a daily analytics report for a scope | `scope` |
| 22 | `scheduleTask` | Scheduling | Schedule a task to be executed later | `when`, `description` |
| 23 | `getScheduledTasks` | Scheduling | List all scheduled tasks | _(none)_ |
| 24 | `cancelScheduledTask` | Scheduling | Cancel a scheduled task by ID | `taskId` |

## @callable() RPC Methods (7 methods)

Exposed via Durable Object RPC for REST compatibility. Called from `index.ts` fetch handler or directly via DO stub.

| Method | Category | Description |
|--------|----------|-------------|
| `callCreateState` | State | Create a state record via RPC |
| `callUpdateState` | State | Update a state record via RPC |
| `callGetStates` | State | List states via RPC |
| `callCreateInstance` | Instance | Create an instance via RPC |
| `callGetInstances` | Instance | Get instances via RPC |
| `callEmitEvent` | Events | Emit a cloud event via RPC |
| `callChannel` | Router | Routes to SearchAgent, DesignAgent, or InterpreterAgent based on action/text |

## Sub-Agents

| Agent | File | Purpose |
|-------|------|---------|
| `InterpreterAgent` | `src/agents/interpreter.ts` | NL text → TAR opcode (quick-parse + Groq LLM fallback) |
| `SearchAgent` | `src/agents/search.ts` | Semantic search over states (delegates to mobile embeddings) |
| `DesignAgent` | `src/agents/design.ts` | Storefront design generation, update, and revert |
| `AnalyticsAgent` | `src/agents/analytics.ts` | Daily report aggregation from trace ledger |

## Durable Objects

| Binding | Class | File | Purpose |
|---------|-------|------|---------|
| `TarAgent` | `TarAgent` | `src/agent.ts` | Main AI chat agent (AIChatAgent + tools + scheduling) |
| `ORDER_DO` | `OrderDO` | `src/do/order.ts` | Cloud event persistence + WebSocket broadcast |
| `SESSION_DO` | `SessionDO` | `src/do/session.ts` | Auth (Google login, sessions, user scopes) |
