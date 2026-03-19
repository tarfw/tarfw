# TAR Mobile App — Working Memory

> **Purpose:** This document serves as the canonical reference for the `tarapp` project. Use it for all future development, onboarding, and architectural decisions.

---

## 🎯 App Overview

**TAR Mobile App** is a React Native (Expo) mobile application that provides a native interface to the TAR Agentic System. It enables users to interact with the commerce OS through natural language, manage semantic memories, view real-time events, and connect to external channels.

### Core Properties
- **Native-first** — Built with React Native + Expo SDK 54
- **AI-powered** — On-device embeddings for semantic search
- **Realtime** — WebSocket connection for live event streaming
- **Offline-capable** — Local Turso DB with sync
- **Cross-platform** — iOS, Android, and Web from single codebase

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TAR Mobile App                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Trace     │  │   Agents    │  │  Memories   │     │
│  │   (Live)    │  │   (NLP)     │  │   (State)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Relay     │  │   Hooks     │  │   Store     │     │
│  │ (Channels)  │  │ (State/WS)  │  │  (Zustand)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Turso DB   │  │  Embeddings │  │   API       │     │
│  │  (Local)    │  │  (on-device)│  │   Client    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   TAR Agentic System    │
              │   (Cloudflare Workers)  │
              └─────────────────────────┘
```

---

## 📱 Tab Navigation

The app uses a 4-tab bottom navigation with a custom blurred tab bar.

| Tab | Route | Icon | Purpose |
|-----|-------|------|---------|
| **Trace** | `/` | Circle | Real-time TAR event stream (WebSocket) |
| **Agents** | `/agents` | Square | Natural language interface to TAR system |
| **Memories** | `/memories` | Albums | State CRUD (products, users, campaigns, etc.) |
| **Relay** | `/relay` | Asterisk | Channel endpoints (Telegram, Slack) |

### Tab Bar Behavior
- **Agents tab** — Shows text input when focused (keyboard-aware)
- **Other tabs** — Shows blurred tab bar with icons
- **Haptic feedback** — Light impact on tab press (iOS)

---

## 🗄️ Data Layer

### Turso (Local SQLite + Remote Sync)

**Connection:**
```typescript
const dbUrl = 'libsql://taragent-tarframework.aws-eu-west-1.turso.io';
const dbToken = '<JWT_TOKEN>';
```

**Operations:**
| Function | Purpose |
|----------|---------|
| `getDb()` | Get/create DB connection |
| `pullData()` | Sync remote → local |
| `pushData()` | Sync local → remote |
| `getAllStates(scope)` | List all states |
| `createStateLocal(...)` | Insert state (auto-push) |
| `updateStateLocal(...)` | Update state (auto-push) |
| `deleteStateLocal(...)` | Delete state (auto-push) |
| `searchStates(vector, scope, limit)` | Semantic search by embedding |

**Scope:** All operations default to `scope = 'shop:main'`

---

## 🧠 Embeddings (On-device AI)

**Library:** `react-native-rag` (Executorch)
**Model:** `all-MiniLM-L6-v2_xnnpack.pte` (stored in `assets/models/`)

### API
```typescript
import { generateEmbedding, generateEmbeddings } from '@/src/lib/embeddings';

// Single embedding
const vector = await generateEmbedding("red shoes size 10");

// Batch embeddings
const vectors = await generateEmbeddings(["product A", "product B"]);
```

**Usage:** Semantic search in Memories tab, intent matching in Agents

---

## 📡 API Client

**Base URL:** `https://taragent.wetarteam.workers.dev`

### Channel API (Natural Language)
```typescript
sendChannelMessage({
  channel: 'app_agent',
  userId: 'mobile_user_01',
  scope: 'shop:main',
  text: 'sell 2 apples',
  // or action: 'SEARCH'
});
```

### State API (Direct CRUD)
```typescript
createStateApi(ucode, title, payload, scope);
updateStateApi(ucode, title, payload, scope);
deleteStateApi(ucode, scope);
readStateApi(ucode, scope);
```

---

## 🧩 State Management

### useAgentState Hook (React Context)

**Provider:** `<AgentProvider>` wraps all tabs

**State:**
```typescript
{
  loading: boolean;
  result: any;        // API response or search results
  setLoading: (v) => void;
  setResult: (v) => void;
  loadStates: () => Promise<void>;
  createState: (ucode, title, payload) => Promise<void>;
  updateState: (ucode, title, payload) => Promise<void>;
  deleteState: (ucode) => Promise<void>;
  search: (query) => Promise<void>;  // Semantic search
}
```

### useLiveEvents Hook (WebSocket)

**Connection:** `wss://taragent.wetarteam.workers.dev/api/live/shop:main`

**Returns:**
```typescript
{
  events: LiveEvent[];   // Last 50 events
  status: 'Connecting...' | 'Connected' | 'Error' | 'Reconnecting...';
}
```

**LiveEvent:**
```typescript
{
  opcode: number;
  delta: number;
  streamid: string;
  status: string;
  timestamp: string;
}
```

**Auto-reconnect:** 3-second delay on disconnect

---

## 🎨 UI Components

### Screens

| Screen | File | Features |
|--------|------|----------|
| **Trace** | `src/screens/trace.tsx` | Live event feed, opcode badges, pulse animation |
| **Agents** | `src/screens/aiagents.tsx` | NLP input, opcode results, semantic search cards |
| **Memories** | `src/screens/memories.tsx` | State CRUD, type filters, search (keyword + AI) |
| **Relay** | `src/screens/relay.tsx` | Channel endpoint list (copy to clipboard) |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `CustomTabBar.tsx` | Blurred tab bar + Agents text input |
| `StateFormModal.tsx` | Dynamic form for state create/edit |
| `StateTypePickerModal.tsx` | Type selection for new states |
| `themed-text.tsx` / `themed-view.tsx` | Theme-aware primitives |
| `ui/collapsible.tsx` | Animated collapsible section |

---

## 📋 State Types (Schema Definitions)

**File:** `src/config/stateSchemas.ts`

| Type | Label | Icon | Key Fields |
|------|-------|------|------------|
| `product` | Product | cube | price, currency, stock, brand, sku, sizes, colors, images |
| `service` | Service | briefcase | price, duration, unit, availability |
| `category` | Category | folder | parentCategory, icon, order |
| `brand` | Brand | shield-checkmark | logo, website, country |
| `collection` | Collection | albums | description, tags, productIds |
| `user` | User | person | email, phone, role, avatar |
| `store` | Store | storefront | address, lat, lng, phone, hours |
| `form` | Form | document-text | description, submitAction, fields |
| `campaign` | Campaign | megaphone | startDate, endDate, discount, targetAudience |
| `page` | Page | browsers | slug, content, seoTitle, seoDesc |
| `section` | Section | grid | layout, order, components |
| `media` | Media | image | url, mimeType, size, alt |
| `location` | Location | location | address, lat, lng, h3 |
| `tag` | Tag | pricetag | color, icon, group |

**Form behavior:** Dynamic fields based on selected type

---

## 🔢 Opcode Reference (Trace Screen)

Full opcode map displayed in Trace screen:

### Stock (1xx)
| Opcode | Name | Color | Icon |
|--------|------|-------|------|
| 101 | STOCKIN | Green | arrow-down-circle |
| 102 | SALEOUT | Red | arrow-up-circle |
| 103 | SALERETURN | Orange | return-down-back |
| 104 | STOCKADJUST | Purple | git-compare |
| 105 | TRANSFEROUT | Violet | arrow-forward-circle |
| 106 | TRANSFERIN | Blue | arrow-back-circle |
| 107 | STOCKVOID | Gray | close-circle |

### Invoice (2xx)
| Opcode | Name | Color | Icon |
|--------|------|-------|------|
| 201 | INVOICECREATE | Blue | document-text |
| 202 | ITEMADD | Blue | add-circle |
| 203 | INVOICEPAYMENT | Green | cash |
| 204 | PAYMENTFAIL | Red | close-circle |
| 205 | INVOICEVOID | Gray | trash |
| 206 | ITEMDEFINE | Blue | list-circle |
| 207 | INVOICEREFUND | Orange | refresh-circle |

### Task (3xx)
| Opcode | Name | Color | Icon |
|--------|------|-------|------|
| 301 | TASKCREATE | Purple | checkbox |
| 302 | TASKASSIGN | Purple | person |
| 303 | TASKSTART | Blue | play-circle |
| 304 | TASKPROGRESS | Orange | time |
| 305 | TASKDONE | Green | checkmark-circle |
| 306 | TASKFAIL | Red | close-circle |
| 307 | TASKBLOCK | Orange | pause-circle |
| 308 | TASKRESUME | Blue | play-skip-forward |
| 309 | TASKVOID | Gray | close |
| 310 | TASKLINK | Purple | link |
| 311 | TASKCOMMENT | Blue | chatbubble |

### Accounts (4xx), Orders (5xx), Transport (6xx), Tax (7xx), Memory (8xx), Identity (9xx)
*(See full list in `src/screens/trace.tsx` or `src/screens/aiagents.tsx`)*

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Expo SDK 54 (React Native 0.81.5) |
| **Navigation** | Expo Router 6 (file-based) |
| **State** | React Context + Zustand |
| **Database** | Turso (libsql) via `@tursodatabase/sync-react-native` |
| **AI/Embeddings** | `react-native-rag` (Executorch) |
| **Styling** | NativeWind (Tailwind) + StyleSheet |
| **Icons** | Lucide React Native + Ionicons + MaterialCommunityIcons |
| **Animations** | React Native Reanimated |
| **UI** | Custom components + Bottom Sheet (@gorhom/bottom-sheet) |
| **Build** | EAS Build |

---

## 📦 Project Structure

```
tarapp/
├── app/                          # Expo Router pages
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator + AgentProvider
│   │   ├── index.tsx             # Trace screen
│   │   ├── agents.tsx            # Agents screen
│   │   ├── memories.tsx          # Memories screen
│   │   └── relay.tsx             # Relay screen
│   ├── _layout.tsx               # Root layout + ThemeProvider
│   └── modal.tsx                 # Modal route
├── src/
│   ├── screens/                  # Screen implementations
│   │   ├── trace.tsx             # Live event feed
│   │   ├── aiagents.tsx          # NLP interface
│   │   ├── memories.tsx          # State CRUD
│   │   └── relay.tsx             # Channel endpoints
│   ├── api/
│   │   └── client.ts             # API client (Channel + State)
│   ├── db/
│   │   └── turso.ts              # Turso DB + CRUD operations
│   ├── lib/
│   │   └── embeddings.ts         # On-device embedding generation
│   └── config/
│       └── stateSchemas.ts       # State type definitions
├── components/
│   ├── CustomTabBar.tsx          # Custom blurred tab bar
│   ├── StateFormModal.tsx        # Dynamic state form
│   ├── StateTypePickerModal.tsx  # Type selection modal
│   ├── ui/
│   └── ...
├── hooks/
│   ├── useAgentState.tsx         # Global state context
│   ├── useLiveEvents.ts          # WebSocket hook
│   ├── useKeyboard.ts            # Keyboard visibility
│   ├── use-color-scheme.ts       # Theme detection
│   └── ...
├── constants/
│   └── theme.ts                  # Colors + fonts
├── assets/
│   └── models/
│       └── all-MiniLM-L6-v2_xnnpack.pte  # Embedding model
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Start dev server (Expo Go / development build)
npm start          # or: npx expo start

# Run on specific platform
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser

# Lint
npm run lint

# Reset project (move starter code to app-example/)
npm run reset-project
```

---

## 🔐 Environment & Configuration

### app.json Key Settings
```json
{
  "expo": {
    "name": "tar",
    "slug": "tar",
    "scheme": "tarapp",
    "ios": { "bundleIdentifier": "com.tarfw.tar" },
    "android": { "package": "com.tarfw.tar" },
    "newArchEnabled": true,
    "experiments": { "reactCompiler": true }
  }
}
```

### EAS Build (eas.json)
```json
{
  "cli": { "version": ">= 0.43.0" },
  "build": {
    "development": { "developmentClient": true },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

---

## 📝 Key Design Decisions

1. **Local-first with sync** — Turso local DB for offline, push/pull for sync
2. **On-device AI** — Embeddings generated on device (no API calls, privacy-first)
3. **WebSocket-first realtime** — Trace screen always connected to live events
4. **Type-safe state** — Dynamic forms based on state type schemas
5. **Multi-tab architecture** — Separation of concerns (Trace/Agents/Memories/Relay)
6. **Semantic + keyword search** — Toggle between AI and text-based search
7. **Auto-reconnect** — WebSocket auto-reconnects on disconnect (3s delay)

---

## 🔮 Future Development Guidelines

When extending the app:

1. **New screens** — Add route in `app/(tabs)/` or `app/` folder
2. **New state types** — Add to `STATE_TYPES` in `src/config/stateSchemas.ts`
3. **New API endpoints** — Add to `src/api/client.ts`
4. **New hooks** — Create in `hooks/` folder with proper TypeScript types
5. **New opcodes** — Update `OPCODE_META` in `trace.tsx` and `aiagents.tsx`
6. **Performance** — Use `React.memo` for list items, optimize re-renders
7. **Testing** — Add Jest tests for hooks, components, and API client

---

## 🐛 Known Patterns & Conventions

### State UCode Format
```
{type}:{id}
// Examples: product:apple, user:ravi, order:1001
```

### Search Behavior
- **Keyword mode** — Filters by `title` and `ucode` (case-insensitive)
- **AI mode** — Semantic search via `vector_distance` on embeddings

### Error Handling
- API errors → Alert dialog with message
- WebSocket errors → Status badge shows "Error" → auto-reconnect
- DB errors → Console log + fallback to cached data

### Loading States
- Global `loading` state from `useAgentState` context
- Per-screen loading indicators (ActivityIndicator)
- Pull-to-refresh on Memories screen

---

## 📚 Related Documents

| File | Purpose |
|------|---------|
| `../taragent.md` | Backend (taragent) working memory |
| `../taragent/plan.md` | Original architecture plan |
| `../taragent/schema.sql` | Database schema |
| `README.md` | Expo getting started guide |

---

*Last updated: 2026-03-19*
*Version: 1.0 (Production-ready)*
