# TAR Framework — Finalized Stack (Tamil Scale, 80M users in 36 months)

Status: planning doc
Target scale: 70–85M users, 3–5M sellers, 10–15B events/day by Y3
Primary market: Tamil Nadu + Tamil diaspora (Singapore, Malaysia, global)
Compliance: DPDP Act 2023, RBI data localization, ONDC-compatible

---

## 1. Scale targets by year

| Dimension | Y1 | Y2 | Y3 | Y4 |
|---|---|---|---|---|
| Users | <500K | 5–20M | 20–40M | 70–85M |
| DAU peak | 200K | 8–15M | 20–30M | 30–45M |
| Sellers / stores | <50K | 200K–1M | 1–3M | 3–5M |
| Devices online | 500K | 20M | 30–45M | 40–60M |
| Catalog SKUs | 1–10M | 50–200M | 300–600M | 500M–1B |
| Events/day | 10M | 1–2B | 5–10B | 10–15B |
| Peak QPS | 5K | 200K | 500K | 1–2M |

---

## 2. The stack (one-table overview)

| Layer | Component | Tech | Where it lives |
|---|---|---|---|
| Client | `tarapp` (React Native) | Expo + `@tursodatabase/sync-react-native` | iOS / Android devices |
| Edge | API + caching | Cloudflare Workers + Cache + `EdgeCacheDO` | Cloudflare global |
| AI agents | Per-user orchestration | Cloudflare Durable Object (`TarAgent`) | Cloudflare |
| Real-time | Live state fan-out | Cloudflare DOs + WebSocket | Cloudflare |
| Inference | LLM serving | Groq (`openai/gpt-oss-120b`) — fixed for initial launch | Groq Cloud |
| Catalog (`state` + vectors + FTS) | Shared universal catalog | Turso Cloud — one shared DB | Turso Cloud |
| Instance (shared stock) | Cross-store discovery DB | Turso Cloud — one shared DB | Turso Cloud |
| Auth + payments | RBI/DPDP compliant | Turso Cloud | Turso Cloud |
| Agent memory | Curated semantic recall | Turso Cloud vector DB | Turso Cloud |
| Events | All events (no archive split) | Turso Cloud — same DB | Turso Cloud |

---

## 3. Database layout — where each table lives

| Table | Home | Local-first? | Retention |
|---|---|---|---|
| `state` (catalog + vectors + FTS) | Turso shared catalog DB | ❌ HTTP + edge cache | Forever |
| `instance` (every store's stock) | **Turso shared instance DB** (single logical, shard by `h3_prefix` later) | ✅ **Own-store slice only** on seller devices | Live |
| `events` (all) | Turso Cloud events DB + device replica (filtered) | ✅ Filtered (own store) | All (on Turso Cloud) |
| `agent_memory` | Turso vector DB (separate) | ❌ | Indefinite |
| `auth` | Turso Cloud | ❌ | Per policy |
| `payments_ledger` | Turso Cloud (BYOK) | ❌ | 7 years |

**Why `instance` is one shared DB:** agentic discovery ("find biryani near me", "plumber in Adyar") requires cross-store search. Sharded per-store DBs make this impossible. One shared `instance` with `h3_prefix` index enables geo-bounded scatter queries.

---

## 4. Local-first strategy (tarapp)

Only sync what the device uses offline. Never pull the full DB.

| Data class | Local-first? | Device size |
|---|---|---|
| Open events (order in flight, shift running, draft cart) | ✅ | <5 MB |
| Recent closed events (last 72h) | ✅ | <10 MB |
| Historical events | ❌ — fetch on demand | 0 |
| Seller's own `instance` rows | ✅ | 1–50 MB |
| Other stores' instances | ❌ | 0 |
| Catalog (`state`) | ❌ HTTP only | 0 |
| Agent memory | ❌ | 0 |

Nightly sweep on device: `DELETE FROM events WHERE status='closed' AND ts < now()-72h`.

---

## 5. Events architecture (initial launch — simplified)

All events stay on Turso Cloud. No archive split, no ClickHouse, no anonymization sweeper for initial launch.

### Write path

| Step | Component | Action |
|---|---|---|
| 1 | `tarapp` | Write locally to libSQL (open or recent) |
| 2 | libSQL sync | Push to Turso Cloud events DB |

### Read path

| Query | Hits | Latency |
|---|---|---|
| "What's open right now?" | Local libSQL | <5 ms |
| "Today's orders" | Local libSQL | <5 ms |
| "Last week" | Turso Cloud events DB | ~50 ms |
| "Historical" | Turso Cloud events DB | ~50–200 ms |
| "Agent similar past event" | Turso Cloud `agent_memory` vector | ~50 ms |

**Future:** When scale demands it, add ClickHouse archive + WriteBatcherDO + anonymization sweeper.

---

## 6. Cloudflare Durable Objects + WebSocket — full map

| DO | Per | WS | Purpose |
|---|---|---|---|
| `TarAgent` | user × store | ✅ | AI conversation; runs the 100 use cases |
| `EventHub` | store | ✅ | Pub/sub bus for live listeners |
| `OrderRoom` | active order | ✅ | Cashier + KDS + runner + customer |
| `KitchenDisplay` | store | ✅ | New-order push to KDS |
| `Presence` | store | ✅ | Staff clock-in/out status |
| `DeliveryTrack` | delivery | ✅ | Courier GPS → customer + manager |
| `PaymentSession` | UPI txn | ✅ | Live payment status |
| `CampaignRunner` | campaign | cron | Marketing fan-out |
| `LiveDashboard` | manager session | ✅ | Sales / peak-hour push |
| **`EdgeCacheDO`** | popular query | ❌ | Cache hot discovery queries (cost) |

**Rule:** DO + WebSocket = all live state and AI orchestration. `EdgeCacheDO` is a cost-control lever, built from v1. `WriteBatcherDO` deferred until archive layer is needed.

---

## 7. Agentic search flow (why the architecture is correct)

| Step | Component | Action |
|---|---|---|
| 1 | User → tarapp | "Find biryani near Adyar under ₹200" |
| 2 | tarapp → `TarAgent` DO | Forward intent + geo (h3) |
| 3 | `TarAgent` → catalog (HTTP, edge-cached) | Vector search on `state` → ucodes for biryani |
| 4 | `TarAgent` → shared `instance` DB | `SELECT … WHERE stateid IN (…) AND h3_prefix LIKE 'xx%' AND value < 200 AND available = 1` |
| 5 | `TarAgent` → user | Ranked list of stores with biryani, price, distance, ETA |
| 6 | User orders → cashier's per-store local-first POS path | |

This only works because `instance` is **one shared DB**. Sharded per-store DBs would require fan-out to thousands of DBs per query.

---

## 8. Inference strategy (initial launch)

| Phase | Provider | Model | Why |
|---|---|---|---|
| **Initial launch** | Groq | `openai/gpt-oss-120b` | Fixed model, fast + capable for all use cases |

**Rule:** pluggable provider interface from v1. Model can be upgraded later without code changes beyond config.

---

## 9. Cost projection (INR, all-in, per month)

| Phase | Users | Turso BYOC | Cloudflare | Contabo (events) | Inference | Other | **Total ₹/mo** |
|---|---|---|---|---|---|---|---|
| Y1 (0–9 mo) | <500K | ₹1.5–4 L | ₹50K–1.5 L | — | ₹50K–2 L | — | **₹2.5 – 7.5 L** |
| Y2 (9–18 mo) | 5–20M | ₹15–40 L | ₹4–12 L | ₹3–6 L | ₹6–20 L | ₹1–3 L | **₹29 – 82 L** |
| Y3 (18–24 mo) | 20–40M | ₹50 L – 1.2 Cr | ₹10–30 L | ₹5–12 L | ₹20 L – 70 L | ₹3–6 L | **₹88 L – 2.4 Cr** |
| Y4 (24–36 mo) | 70–85M | ₹1.2 – 2 Cr | ₹20–50 L | ₹8–18 L | ₹40 L – 1.5 Cr | ₹5–10 L | **₹1.95 – 4.3 Cr** |

At Y4 peak: ~₹0.7–1.5 per DAU/month — sustainable on any commerce take rate.

### Why this is the right cost shape

| Alternative | Y3 cost | Verdict |
|---|---|---|
| All on Turso managed (no BYOC, no ClickHouse) | ₹8 – 15 Cr | Rejected |
| Turso BYOC AWS, events stay in Turso | ₹3 – 4 Cr | Rejected |
| Turso BYOC AWS + same-account S3 tiered for events | ₹1.5 – 2.8 Cr | Good but ClickHouse cheaper |
| **Turso BYOC AWS + ClickHouse Contabo Singapore (with anonymized archive)** | **₹88 L – 2.4 Cr** | **Chosen** — India-accessible, DPDP-safe |
| Fallback: Turso BYOC AWS + ClickHouse on E2E Networks Mumbai (pure India, no anonymization needed) | ₹1.1 – 2.7 Cr | Hedge if Contabo restricts |

---

## 10. Phased rollout

| Phase | Months | Users | Architecture moves |
|---|---|---|---|
| **0 — MVP** | 0–3 | <10K | Current Turso Cloud + Cloudflare DOs. Fix sync to filter by store. |
| **1 — Pilot 4 cities** | 3–9 | 100K–500K | Adopt Turso next-gen. Add `WriteBatcherDO` + `EdgeCacheDO`. ONDC sandbox. |
| **2 — Full TN** | 9–18 | 5–20M | **Cut over hot path to Turso Cloud**. Stand up ClickHouse on Hetzner. Materialized geo-bins. DPDP audit. |
| **3 — TN + SG/MY diaspora** | 18–24 | 20–40M | Add Hyderabad BYOC replica. Bedrock Mumbai inference. Shard `instance` by h3 if needed. |
| **4 — Full Tamil reach** | 24–36 | 70–85M | Multi-DC Indian (Mumbai + Chennai + Hyderabad). Self-hosted Llama on AWS H100. AWS EDP 3-year signed. |

---

## 11. Build-from-day-1 requirements

These are non-negotiable from v1; retrofitting them at scale is impossible.

| Decision | Why |
|---|---|
| **Filtered embedded replica** (own-store rows only) | 5M stores × full sync breaks every device |
| **`h3_prefix_4`, `h3_prefix_6`** columns on `instance` | Geo discovery queries + future sharding |
| Extended `events` schema: `domain`, `actor_type`, `actor_id`, `agent_id`, `agent_run_id`, `causation_id`, `correlation_id`, `idempotency_key`, `payload_version`, `embedding` | Restructuring 10B+ events later is impossible |
| Store DB URL + region **resolved per request** (never hard-coded) | Required for tier migration, shard splits, BYOC cutover |
| `WriteBatcherDO` pipeline from v1 (even at low volume) | Trivial to add now, painful retrofit |
| Cloudflare Worker cache layer for catalog + discovery | Saves 80% row reads instantly |
| Local sweep: `DELETE closed AND ts < now()-72h` | Keeps device DB <50 MB |
| ONDC-compatible event schema | Government mandate inevitable |
| PII encrypted in `payload` (never plaintext) | DPDP fine = 2.5% of revenue |
| Pluggable inference provider | No single-vendor lock at 8M agents |
| All writes idempotent via `idempotency_key` | Agents retry; festival surges; exactly-once required |
| Region tag on every row | Lets you split datasets cleanly |

---

## 12. Risk mitigation

| Risk | Mitigation |
|---|---|
| Festival surge (Pongal, Diwali, Tamil New Year) = 5× load | Pre-warm ClickHouse replicas; DO auto-scales; per-store isolation prevents viral seller from breaking platform |
| One viral product = hot-row contention on `instance` | Cloudflare Worker cache TTL 30–120s; Turso next-gen concurrent writes |
| Mumbai region outage | Hyderabad read replica (Y3); RPO <5 min; monthly failover drill |
| Vendor risk (Turso / Cloudflare / Groq) | Pluggable interfaces; ClickHouse/libSQL/Parquet are open formats; no vendor-only DSLs |
| Runaway AI agent floods events | Per-agent rate limits + `agent_run_id` kill switch; circuit breakers in `TarAgent` DO |
| DPDP regulator request for user data export | Indexed `correlation_id` across all tiers; pre-built export tooling |
| AWS region pricing shock | ClickHouse events layer is on Hetzner (EU), not AWS — hedge |
| Low-bandwidth rural user | Sync delta budget 50 KB max; paginated; local-first means offline works fully |

---

## 13. Engineering team shape

| Phase | Headcount |
|---|---|
| Y1 | 3–5 engineers (full-stack) |
| Y2 | +1 SRE / DBA, +1 mobile, +1 AI/ML |
| Y3 | Total ~12–15; +1 dedicated ClickHouse ops, +1 Turso ops |
| Y4 | Total ~20–25; sub-teams (infra, AI, mobile, backend, data) |

Infra savings from self-hosted ClickHouse + Turso BYOC dwarf the SRE headcount cost from Y2 onward.

---

## 14. Decision log (why not X)

| Option | Rejected because |
|---|---|
| Cloudflare D1 for instance | Still one region primary; no local-first RN sync |
| Cloudflare DO SQLite for per-store instance | Kills cross-store agentic discovery (can't search other stores) |
| Per-store Turso DB per store | Same — breaks cross-store queries; 5M DBs is operationally brittle |
| Self-hosted libSQL (Hetzner / E2E) | No React Native sync client exists; tied to Turso Cloud for RN |
| AWS Kinesis Firehose + S3 + Athena | $$$ and AWS lock-in; ClickHouse is faster, cheaper, open |
| BigQuery / Snowflake for events | 10–30× more expensive at PB scale |
| Cloudflare Vectorize for agent memory | Turso native vectors work; one fewer vendor |
| Apache Druid | Good but more ops complexity than ClickHouse |
| TimescaleDB | Fine at 100 TB; ClickHouse wins at PB |
| Keep events on Turso only | Turso row-write pricing = ₹4–5 Cr/month at Y3 |
| S3 tiered in same AWS as Turso BYOC | Works, but ClickHouse is 5–10× cheaper and 100× faster to query |
| Backblaze B2 + DuckDB | Zero-ops alternative if SRE capacity unavailable — good fallback |

---

## 15. TL;DR in 5 lines

1. **Turso Cloud** for `state`, `instance`, `events-hot-7d`, auth, payments — shared DBs (not per-store) so agentic search works.
2. **Local-first on `tarapp`** via libSQL embedded replica, filtered to the user's own slice (seller = own store, buyer = cart/favorites).
3. **All real-time + AI on Cloudflare** — DOs + WebSockets for `TarAgent`, orders, KDS, delivery, payments, plus `WriteBatcherDO` + `EdgeCacheDO` for cost control.
4. **ClickHouse on Contabo Singapore** for events archive (7+ years, ~250 TB compressed) — India-accessible Hetzner substitute. Pseudonymized sweeper keeps PII in India, allows archive to legally sit outside. ₹5–12 L/month vs ₹1.6 Cr if kept in Turso. Fallback to E2E Networks Mumbai (pure-India, ~3× more expensive) if Contabo restricts.
5. **Cost shape:** ₹2.5–7.5 L (Y1) → ₹28–80 L (Y2) → ₹86 L – 2.3 Cr (Y3) → ₹1.9–4.2 Cr (Y4 full Tamil reach). ~₹0.7–1.5 per DAU per month at peak.
