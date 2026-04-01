# Cloudflare Durable Objects — Cost Reference

## How Hibernation Works

- WebSocket connections are held at **Cloudflare edge (CDN)**, not inside the DO
- DO sleeps between messages — idle WebSockets cost **$0**
- DO wakes only on: incoming WS message, HTTP request, or alarm
- 1000 clients connected idle all month = **$0**

## Cloudflare DO Pricing (No Free Tier)

| Resource | Rate |
|---|---|
| DO Requests | $0.15 per million |
| DO Duration (awake) | $12.50 per million GB-s |
| DO Duration (hibernated) | **$0** |
| SQLite Rows Read | $0.001 per million |
| SQLite Rows Written | $0.001 per million |
| SQLite Storage | $0.20 per GB/month |
| Workers Paid Plan | $5/month (required) |

## Free Tier Included (Workers Paid $5/mo)

| Resource | Free Allowance |
|---|---|
| DO Requests | 1M/month |
| DO Duration | 400K GB-s/month |
| SQLite Rows Read | 5M/day |
| SQLite Rows Written | 100K/day |
| SQLite Storage | 5 GB |

## Cost at 10K Events/Day × 30 Days (Pure Usage, No Free Tier)

| Resource | Usage | USD | INR (₹84/$) |
|---|---|---|---|
| DO Requests (5 clients) | 1.8M | $0.27 | ₹23 |
| DO Duration | 0.04 GB-s | $0.0005 | ₹0.04 |
| SQLite Read/Write | 900K rows | $0.001 | ₹0.08 |
| SQLite Storage | 50MB | $0.01 | ₹0.84 |
| **Pure usage total** | | **$0.28** | **₹24** |

## Broadcast Cost Scales with Clients

Each event broadcast = 1 DO request per connected client.

| Connected Clients | 10K events/day × 30 days | USD/mo | INR/mo |
|---|---|---|---|
| 5 | 1.8M requests | $0.27 | ₹23 |
| 100 | 30M requests | $4.50 | ₹378 |
| 1,000 | 300M requests | $45 | ₹3,780 |
| 10,000 | 3B requests | $450 | ₹37,800 |

## Cost Optimization

- **Scope-based DOs**: Each scope gets its own DO instance, so broadcasts only go to relevant clients
- **Batch broadcasts**: Combine multiple events into one WS message
- **Filter server-side**: Only send events the client subscribed to
