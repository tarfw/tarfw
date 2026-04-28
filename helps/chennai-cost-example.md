# Chennai High-Scale Cost Example

Full worked scenario: TAR stack cost at Chennai city scale, Y3. Compares Turso Scaler vs BYOC AWS Mumbai. Includes CRUD/archive sweep impact and bandwidth.

## 1. Scenario definition

Chennai city, Y3-scale on the TAR framework (Turso BYOC AWS Mumbai + Cloudflare + ClickHouse Contabo SGP).

| Dimension | Value |
|---|---|
| Restaurants (busy) | 100K |
| Delivery riders | 500K |
| Active customers | 10M |
| Catalog SKUs (state) | ~20M |
| Instance rows | ~20M (stores × SKUs) |
| Events/day aggregate | ~2–3B |
| Events/mo aggregate | ~60–90B |

## 2. Per-entity profile

| Entity | Daily activity | Monthly events | Local-first slice | Team size |
|---|---|---|---|---|
| Restaurant | 500 orders/day, KDS + cashier + manager + waiter | ~420K | own store instance (~200 SKUs) + open events + 72h | 4 devices |
| Delivery person | 30 trips/day, GPS every 10s (GPS → ClickHouse direct) | ~550K (only 9K hit Turso) | own trips open + 72h | 1 device |
| Customer | 10 orders/mo, 30 app opens | ~100 | cart + favorites only | 1 device |

## 3. Local-first slice per entity

| Entity | `instance` local-first? | `events` local-first? |
|---|---|---|
| Restaurant (seller) | own store rows only (~200 SKUs, 1–5 MB) | open + last 72h for that store |
| Delivery person | not a store owner — active assignment pulled on demand | open trips + last 72h of own trips |
| Buyer/user | cart/favorites only (tiny slice, not full instance) | own open orders + last 72h |

Rule: local-first = the slice *you* act on offline. Never the full table. Device DB stays <50 MB.

## 4. CRUD accounting — all ops count on Turso

| Op | Counted as | Example |
|---|---|---|
| INSERT | 1 write/row | new order event |
| UPDATE | 1 write/row | `instance.qty` change |
| DELETE | 1 write/row | archive sweep |
| SELECT | 1 read/row returned | menu fetch, agent query, sync pull |

**Archive sweep doubles the write count.** Path = read row (for ClickHouse export) + delete row. Per restaurant/month:

| Step | Writes | Reads |
|---|---|---|
| Insert events + instance updates | ~435K | — |
| `WriteBatcherDO` reads rows before exporting to ClickHouse | — | ~420K |
| Server-side `DELETE WHERE ts<now()-7d` after archive | ~420K | — |
| Team devices sync-pull deltas (3 peers) | — | ~1.26M |
| **Total** | **~855K** | **~1.68M** |

## 5. Per-entity Turso cost — Scaler (with archive sweep)

Scaler plan = $29/mo base + $1 / 1M row writes overage + $1 / 1B row reads overage.

| Entity | Writes/mo | Reads/mo | Scaler overage ₹/mo |
|---|---|---|---|
| Restaurant + team | ~855K | ~1.68M | **~₹72** |
| Delivery person | ~18K | ~54K | **~₹1.50** |
| Customer | ~200 | ~600 | **~₹0.02** |

## 6. Per-entity Turso cost — BYOC AWS Mumbai (flat contract)

BYOC = flat Turso contract + pay AWS directly. No per-row metering. Chennai-scale AWS infra breakdown:

| Component | Sizing | ₹/mo |
|---|---|---|
| EC2 primary writers (r6i.4xlarge × 2, HA) | 32K writes/sec avg, 200K peak | ~₹2 L |
| EC2 read replicas (r6i.2xlarge × 4) | Sync fan-out to 10.6M devices | ~₹2 L |
| EBS gp3 (~5 TB DBs) + snapshots | state + instance + 7d events + auth | ~₹0.4 L |
| S3 backup / PITR | Daily snapshots | ~₹0.1 L |
| AWS egress — device sync (~26 TB/mo) | Delta frames to tarapp devices | ~₹2 L |
| AWS egress — archive to ClickHouse (~35 TB/mo) | Events > 7d → Contabo SGP | ~₹3 L |
| **Turso BYOC contract fee (flat, negotiated)** | Control plane, ops, support | **~₹8 L** |
| **Chennai BYOC Turso total** | | **~₹17–18 L/mo** |

Per-entity Turso share:

| Entity | Scaler ₹/mo | BYOC AWS ₹/mo | Δ |
|---|---|---|---|
| Restaurant + team | ~₹72 | **~₹12** | 6× cheaper |
| Delivery person | ~₹1.50 | **~₹1.50** | same |
| Customer | ~₹0.02 | **~₹0.15** | Scaler wins at tail |

## 7. Full-stack ₹/mo per entity (BYOC path — chosen)

| Entity | Turso (BYOC) | ClickHouse | CF DO + WS | Inference | **Total ₹/mo** |
|---|---|---|---|---|---|
| Restaurant + team | ₹12 | ₹8 | ₹20 | ₹10 | **₹50** |
| Delivery person | ₹1.50 | ₹6 | ₹8 | ₹1 | **₹16** |
| Customer | ₹0.15 | ₹0.10 | ₹0.50 | ₹1 | **₹2** |

## 8. Chennai aggregate ₹/mo

| Line | Math | ₹ |
|---|---|---|
| Restaurants | 100K × ₹50 | ₹50 L |
| Riders | 500K × ₹16 | ₹80 L |
| Customers | 10M × ₹2 | ₹2 Cr |
| **Chennai total** | | **~₹3.3 Cr/mo** |
| Chennai revenue potential (2–3% take rate on GMV) | | ₹20–50 Cr/mo |
| **Margin** | | **healthy** |

Blended: **~₹0.9–1.5 per DAU/mo** — matches the Tamil Y4 target.

## 9. Scaler vs BYOC at aggregate

| Scope | Scaler ₹/mo | BYOC AWS ₹/mo | Gap |
|---|---|---|---|
| Chennai alone (writes incl. sweep ~96 B/mo) | ~₹81 L | ~₹17–18 L | ~5× |
| Tamil Y3 (~20× Chennai) | ~₹8 Cr | ~₹50 L – 1.2 Cr | ~5–15× |

Scaler is fine for Y1 (<500K users, <1B writes/mo). Past that, per-row metering collapses. Phase 2 rollout cuts over to BYOC AWS Mumbai for the heavy DBs (state, instance, events-hot, auth, payments).

## 10. Events architecture reminder (why Turso-hot + ClickHouse-archive wins)

| Tier | Where | Retention | Why |
|---|---|---|---|
| Open + 72h | Device libSQL (own slice) | 72h | Offline, <5 ms, agent context |
| Hot (7 days) | Turso BYOC AWS Mumbai | 7d | Live dashboards, team sync |
| Archive (7 years) | ClickHouse self-hosted Contabo SGP | 7y | OLAP at PB, 10:1 compression, DPDP-safe anonymized |

Write path: tarapp → Turso hot → `WriteBatcherDO` (1024 shards, Parquet) → ClickHouse → nightly sweep deletes from Turso.
