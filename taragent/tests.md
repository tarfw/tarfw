# Universal Commerce OS - Test Cases 🚀

All commands target the production endpoint: `https://taragent.wetarteam.workers.dev/api/channel`

---

### 1. Warehouse Inventory (Opcode 101 - Stock IN)

**Use Case:** Receiving raw materials into a specific warehouse memory.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "terminal",
  "userId": "warehouse_manager",
  "scope": "warehouse:north",
  "text": "receive 500 units of organic cotton"
}'
```

---

### 2. Point of Sale (Opcode 102 - Stock OUT)

**Use Case:** Direct retail sale subtracting from live inventory.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "pos_system",
  "userId": "cashier_04",
  "scope": "shop:downtown",
  "text": "sold 3 dark chocolate bars"
}'
```

---

### 3. Operations & Facilities (Opcode 301 - Task/Schedule)

**Use Case:** Scheduling a future task via the OS's Durable Object Alarms.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "facility_app",
  "userId": "janitor_lead",
  "scope": "facility:gym_zero",
  "text": "schedule floor cleaning for tonight at 11pm"
}'
```

---

### 4. Logistics & Distribution (Opcode 102 - Stock OUT)

**Use Case:** Shipping high-value items out of a corporate hub.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "logistics_agent",
  "userId": "dispatcher_09",
  "scope": "corp:tech_hq",
  "text": "shipped out 20 high-end laptops to service center"
}'
```

---

### 5. Semantic Memory/Catalog Addition (Auto-Provisioning)

**Use Case:** Registering a new product profile into the global memory ledger.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "admin_panel",
  "userId": "stock_clerk",
  "scope": "shop:farm_market",
  "text": "add 50 jars of local organic honey grade A"
}'
```

---

### 6. Complex Shipping Manifest (Opcode 102)

**Use Case:** Mapping natural language shipping intents to a specific order ID.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "shipping_agent",
  "userId": "manager_01",
  "scope": "branch:east",
  "text": "shipped out 5 premium sofas for customer order #99"
}'
```

---

### 7. Structured CRUD: CREATE (App Interface)

**Use Case:** Directly creating a product with a full payload via a mobile app form.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "app",
  "userId": "owner_01",
  "scope": "shop:cafe_metro",
  "action": "CREATE",
  "data": {
    "ucode": "product:oreo_shake",
    "title": "Oreo Milk Shake",
    "payload": {
       "price": 10,
       "currency": "USD",
       "category": "beverages"
    }
  }
}'
```

---

### 8. Structured CRUD: UPDATE (App Interface)

**Use Case:** Updating an existing product's metadata.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "app",
  "userId": "owner_01",
  "scope": "shop:cafe_metro",
  "action": "UPDATE",
  "data": {
    "ucode": "product:oreo_shake",
    "title": "Oreo Deluxe Shake",
    "payload": {
       "premium": true
    }
  }
}'
```

---

### 9. Structured CRUD: READ (App Interface)

**Use Case:** Fetching state data for a product display.

```bash
curl -X POST https://taragent.wetarteam.workers.dev/api/channel \
-H "Content-Type: application/json" \
-d '{
  "channel": "app",
  "userId": "owner_01",
  "scope": "shop:cafe_metro",
  "action": "READ",
  "data": {
    "ucode": "product:oreo_shake"
  }
}'
```
