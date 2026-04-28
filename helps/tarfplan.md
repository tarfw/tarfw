# TAR Framework — Final Plan (Single Table)

Target: 70–85M Tamil users, 3–5M sellers, 10–15B events/day by Y3 (36-month horizon)
Compliance: DPDP Act 2023, RBI data localization, ONDC-compatible

---

## The stack

| # | Layer | Component | Tech | Where | Why | Y3 ₹/mo |
|---|---|---|---|---|---|---|
| 1 | **Client** | tarapp | React Native + libSQL via `@tursodatabase/sync-react-native` | iOS / Android | Local-first; own-store slice only | included |
| 2 | **Edge** | API + WAF + cache | Cloudflare Workers + Workers Cache + `EdgeCacheDO` | Cloudflare global | Entry point, cuts catalog reads 80% | ₹10–30 L |
| 3 | **AI agents** | Per-user orchestration | Cloudflare DO `TarAgent` | Cloudflare | Runs the 100 use cases | (in #2) |
| 4 | **Real-time** | Live state fan-out | Cloudflare DOs + WebSocket (`EventHub`, `OrderRoom`, `KitchenDisplay`, `Presence`, `DeliveryTrack`, `PaymentSession`, `CampaignRunner`, `LiveDashboard`) | Cloudflare | All live coordination | (in #2) |
| 5 | **Inference** | LLM serving | Groq (`openai/gpt-oss-120b`) — fixed for initial launch | Groq Cloud | Single model, pluggable later | usage-based |
| 6 | **Catalog** | `state` + native vectors + FTS | Turso Cloud — one shared DB | Turso Cloud | Universal SKUs; cross-store discovery | (in #8) |
| 7 | **Instance** | All stores' stock, geo-tagged | Turso Cloud — one shared DB | Turso Cloud | Cross-store agentic search ("find biryani near me") | (in #8) |
| 8 | **All Turso DBs** | state, instance, events, agent memory, auth | Turso Cloud | Turso Cloud | All data on Turso Cloud for initial launch | usage-based |
| 9 | **Events** | All events (no archive split) | Turso Cloud — same DB | Turso Cloud | Simplified: all events stay on Turso Cloud | (in #8) |

---

## Rules baked into the design

| Rule | Detail |
|---|---|
| **Local-first scope** | Seller: own-store rows only. Buyer: cart/favorites only. Open events + last 72h. Device sweeps closed+old nightly. Device DB stays <50 MB. |
| **Event routing** | State-changing events (ORDER, QTY_CHANGED, SHIFT, PAYMENT) → Turso (atomic with `instance`, local-first). Telemetry/trace/GPS → direct ClickHouse via `WriteBatcherDO`. |
| **Single `instance` DB** | Required for cross-store agentic search. Shard by `h3_prefix` only when one DB hits limits. Never per-store DBs. |
| **Events on Turso Cloud** | All events stay on Turso Cloud for initial launch. No archive split. Add ClickHouse + WriteBatcherDO when scale demands it. |
| **Pluggable inference** | Provider interface is pluggable. Fixed to Groq `openai/gpt-oss-120b` for initial launch. |

---

## Must-have from v1 (retrofitting at scale = impossible)

| Decision | Reason |
|---|---|
| Filtered embedded replica (own-store rows only) | 5M stores × full sync breaks every device |
| `h3_prefix_4`, `h3_prefix_6` columns on `instance` | Geo discovery queries + future sharding |
| Extended `events` schema: `domain`, `actor_type`, `actor_id`, `agent_id`, `agent_run_id`, `causation_id`, `correlation_id`, `idempotency_key`, `payload_version`, `embedding` | Restructuring billions of events later = impossible |
| Store DB URL + region **resolved per request** (never hard-coded) | Required for tier migration, shard splits, BYOC cutover |
| `WriteBatcherDO` pipeline design ready (add when archive needed) | Trivial to add later, not needed for initial launch |
| Cloudflare Worker cache layer for catalog + discovery | Saves 80% row reads instantly |
| Local sweep: `DELETE closed AND ts < now()-72h` | Keeps device DB <50 MB |
| ONDC-compatible event schema | Government mandate inevitable |
| PII encrypted in `payload` (never plaintext) | DPDP fine = 2.5% of revenue |
| Pluggable inference provider | No single-vendor lock at 8M agents |
| All writes idempotent via `idempotency_key` | Agents retry; festival surges; exactly-once required |
| Region tag on every row | Lets you split datasets cleanly |

---

## Cost — Initial Launch (INR)

| Component | Monthly cost |
|---|---|
| Turso Cloud (state + instance + events + agent memory) | Usage-based (free tier → pay-as-you-go) |
| Cloudflare Workers + DOs | ₹50K–1.5 L |
| Groq inference (`openai/gpt-oss-120b`) | Usage-based |
| **Total (initial launch, <10K users)** | **< ₹2 L / mo** |

Scale-up costs (archive, BYOC, ClickHouse) deferred until needed.

---

## Agentic discovery flow (why this architecture is correct)

| Step | Component | Action |
|---|---|---|
| 1 | User → tarapp | "Find biryani near Adyar under ₹200" |
| 2 | tarapp → `TarAgent` DO | Forward intent + geo (h3) |
| 3 | `TarAgent` → Turso catalog (HTTP, edge-cached) | Vector search on `state` → ucodes for biryani |
| 4 | `TarAgent` → shared `instance` DB | `SELECT … WHERE stateid IN (…) AND h3_prefix LIKE 'xx%' AND value < 200 AND available=1` |
| 5 | `TarAgent` → user | Ranked stores with biryani, price, distance, ETA |
| 6 | User orders → cashier's per-store local-first POS path | (atomic `instance.qty` decrement + `ORDER` event in Turso) |

Only works because `instance` is **one shared DB**. Sharded per-store DBs would require fan-out to thousands of DBs per query.

---

## Decision log (why not X)

| Option | Rejected because |
|---|---|
| Cloudflare D1 for instance | No React Native local-first sync |
| Cloudflare DO SQLite per-store | Kills cross-store agentic discovery |
| Per-store Turso DB | Same — breaks cross-store queries; 5M DBs operationally brittle |
| Self-hosted libSQL (Hetzner / E2E) | No React Native sync client exists |
| Hetzner self-host | Hostile to Indian customers (KYC rejections, frozen payments) |
| Tiger Cloud / ClickHouse Cloud managed | 5–15× more expensive than self-hosted ClickHouse at PB |
| AWS Kinesis + S3 + Athena | $$$ and AWS lock-in; ClickHouse faster + cheaper + open |
| BigQuery / Snowflake | 10–30× more expensive at PB scale |
| Events entirely on Turso (no external archive) | ₹3.8–5.5 Cr/mo at 7-year retention; libSQL not OLAP — queries take minutes-hours |
| Cloudflare Vectorize | Turso native vectors work; one fewer vendor |
| Backblaze B2 + DuckDB (zero-ops) | Good fallback if no SRE capacity; ~2–3× costlier than ClickHouse, queries slower |

---

## Phased rollout

| Phase | Months | Users | Key moves |
|---|---|---|---|
| **0 — MVP** | 0–3 | <10K | Current Turso Cloud + Cloudflare DOs. Fix sync to filter by store. |
| **1 — Pilot (Chennai + 3 cities)** | 3–9 | 100K–500K | Turso Cloud. Add `EdgeCacheDO`. ONDC sandbox integration. |
| **2+ — Scale** | 9+ | >500K | Evaluate: Turso BYOC, ClickHouse archive, WriteBatcherDO, model upgrades as needed. |

---

## Team shape

| Phase | Headcount |
|---|---|
| Y1 | 3–5 engineers (full-stack) |
| Y2 | +1 SRE/DBA, +1 mobile, +1 AI/ML |
| Y3 | ~12–15; +1 dedicated ClickHouse ops, +1 Turso ops |
| Y4 | ~20–25; sub-teams (infra, AI, mobile, backend, data) |

SRE cost dwarfed by infra savings from Y2 onward.

---

## TL;DR in five lines

1. **Turso Cloud** for `state`, `instance`, events (all), agent memory, auth — shared DBs so agentic search works.
2. **Local-first on `tarapp`** via libSQL embedded replica, filtered to the user's own slice (seller = own store; buyer = cart/favorites).
3. **All real-time + AI on Cloudflare** — DOs + WebSockets for every live surface, `EdgeCacheDO` for cost control.
4. **Groq `openai/gpt-oss-120b`** — fixed model for initial launch. Pluggable provider interface ready for upgrades.
5. **No archive layer yet** — all events on Turso Cloud. Add ClickHouse + WriteBatcherDO when scale demands it.
