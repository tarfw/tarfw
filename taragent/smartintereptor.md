# Smart Interceptor: The TAR Hybrid Parser

The **Smart Interceptor** is a 2-tier intent extraction system that ensures the TAR OS is both lightning-fast and token-efficient.

## 🏗 How It Works

### Tier 1: Deterministic Quick Parse (The "Fast Path")

Before calling any AI models, the system runs the text through a set of high-performance regex and keyword rules.

- **Cost**: 0 Tokens (Free)
- **Latency**: < 5ms
- **Accuracy**: 100% for standard commands.

### Tier 2: Probabilistic AI (The "Deep Path")

If Tier 1 cannot confidently identify the intent, the system hands the message to **Llama 3 8B**.

- **Cost**: ~200-500 Tokens per request
- **Latency**: 1-2 Seconds
- **Accuracy**: High for complex, conversational, or ambiguous sentences.

---

## 📋 Standard Examples (Tier 1 - Instant)

These commands are intercepted immediately without using AI:

| Input Text                 | Opcode | Result                       |
| :------------------------- | :----- | :--------------------------- |
| `"sell 3 product:shoe"`    | 102    | SALEOUT, Delta -3            |
| `"receive 50 apple:mac"`   | 101    | STOCKIN, Delta +50           |
| `"create order for phone"` | 501    | ORDERCREATE, Status: Pending |
| `"task done task:123"`     | 305    | TASKDONE, Status: Done       |
| `"pay out $500"`           | 402    | ACCOUNTPAYOUT, Delta -500    |
| `"remember user:1 is VIP"` | 802    | MEMORYWRITE                  |

---

## 🧠 Conversational Examples (Tier 2 - AI)

These require the "AI Brain" to understand the nuance:

- **Complex instructions**: _"We just got a shipment of 20 speakers but 2 were broken, please record the rest and void the broken ones."_
- **Ambient mentions**: _"I think we should probably finish that research task soon, John."_
- **Slang/Context**: _"Ship those bad boys out to the customer in London."_ (Maps to `502 ORDERSHIP`)

---

## 🔋 Performance & Efficiency

By using the Smart Interceptor, the TAR Agent achieves:

1. **80% Token Reduction**: Most commercial operations follow standard "Action + Qty + Target" patterns that Tier 1 catches.
2. **Instant Feedback**: Users get an immediate response for core tasks without waiting for "Thinking..." indicators.
3. **Infinite Scalability**: Local rule-based parsing scales without hitting Cloudflare AI rate limits.
