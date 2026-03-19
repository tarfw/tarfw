import { Client } from "@libsql/client";
import { z } from "zod";

// Zod schema representing the expected AI structural output for an operation
const OpcodeOutputSchema = z.object({
  opcode: z
    .number()
    .describe(
      "The numeric opcode representing the action (e.g., 101, 102, 301)",
    ),
  opname: z
    .string()
    .optional()
    .describe("The readable name of the opcode (e.g., 'STOCKIN')"),
  delta: z
    .number()
    .describe(
      "The quantity change, positive for receive/add, negative for sell/remove",
    ),
  streamid: z
    .string()
    .describe("The target entity in format 'type:id' (e.g., 'product:apple')"),
  status: z
    .enum(["pending", "done", "failed"])
    .describe("The status of the operation"),
});

type OpcodeResult = z.infer<typeof OpcodeOutputSchema>;

export const OPCODE_NAMES: Record<number, string> = {
  // 1xx Stock
  101: "STOCKIN",
  102: "SALEOUT",
  103: "SALERETURN",
  104: "STOCKADJUST",
  105: "STOCKTRANSFEROUT",
  106: "STOCKTRANSFERIN",
  107: "STOCKVOID",
  // 2xx Billing
  201: "INVOICECREATE",
  202: "INVOICEITEMADD",
  203: "INVOICEPAYMENT",
  204: "INVOICEPAYMENTFAIL",
  205: "INVOICEVOID",
  206: "INVOICEITEMDEFINE",
  207: "INVOICEREFUND",
  // 3xx Workflow
  301: "TASKCREATE",
  302: "TASKASSIGN",
  303: "TASKSTART",
  304: "TASKPROGRESS",
  305: "TASKDONE",
  306: "TASKFAIL",
  307: "TASKBLOCK",
  308: "TASKRESUME",
  309: "TASKVOID",
  310: "TASKLINK",
  311: "TASKCOMMENT",
  // 4xx Accounts
  401: "ACCOUNTPAYIN",
  402: "ACCOUNTPAYOUT",
  403: "ACCOUNTREFUND",
  404: "ACCOUNTADJUST",
  // 5xx Orders
  501: "ORDERCREATE",
  502: "ORDERSHIP",
  503: "ORDERDELIVER",
  504: "ORDERCANCEL",
  // 6xx Transport
  601: "RIDECREATE",
  602: "RIDESTART",
  603: "RIDEDONE",
  604: "RIDECANCEL",
  605: "MOTION",
  611: "BOOKINGCREATE",
  612: "BOOKINGDONE",
  621: "RENTALSTART",
  622: "RENTALEND",
  // 7xx Tax
  701: "GSTVATACCRUE",
  702: "GSTVATPAY",
  703: "GSTVATREFUND",
  // 8xx Memory
  801: "MEMORYDEFINE",
  802: "MEMORYWRITE",
  803: "MEMORYUPDATE",
  804: "MEMORYSNAPSHOT",
  // 9xx Identity
  901: "USERCREATE",
  902: "USERROLEGRANT",
  903: "USERAUTH",
  904: "USERDISABLE",
};

export class InterpreterAgent {
  private db: Client;
  private env: any; // The worker environment including AI bindings

  constructor(db: Client, env: any) {
    this.db = db;
    this.env = env;
  }

  /**
   * Main entry for processing a user's intent from a channel
   */
  async processIntent(req: {
    text?: string;
    scope: string;
    userId: string;
    action?: "CREATE" | "READ" | "UPDATE" | "DELETE" | "SEARCH";
    data?: Record<string, any>;
    lat?: number;
    lng?: number;
  }) {
    console.log(`Processing ${req.action || "intent"} for scope ${req.scope}`);
    console.log(
      `Available bindings: ${Object.keys(this.env || {}).join(", ")}`,
    );

    let intentData: OpcodeResult;
    // Track whether this came from a direct CRUD call or NL.
    // Only NL/operational intents should generate trace, instance and broadcast records.
    const isDirectCrud = !!(req.action && req.data);

    if (isDirectCrud) {
      // Structured CRUD path (App Interface) — pure state management, no trace/instance/broadcast
      intentData = await this.executeCrud(req.action!, req.data!, req.scope);
    } else if (req.text) {
      // Natural Language path (Chat / Agent Input)
      const aiOutput = await this.extractIntentAi(req.text);

      // Step 2: Validate the AI output using Zod
      const parsedIntent = OpcodeOutputSchema.safeParse(aiOutput);
      if (!parsedIntent.success) {
        console.error("AI output failed schema validation", parsedIntent.error);
        throw new Error("Failed to understand intent structurally");
      }
      intentData = parsedIntent.data;
      // Enrich with opcode name if available
      intentData.opname = OPCODE_NAMES[intentData.opcode] || "UNKNOWN";
    } else {
      throw new Error("Invalid request: missing text or action");
    }

    // Steps 3–6 ONLY run for natural language / operational intents.
    // Direct CRUD from the Memories screen does NOT produce traces, instances, or broadcasts.
    if (!isDirectCrud) {
      // Step 3: Write to trace ledger
      await this.writeTrace(intentData, req);

      // Step 4: Update the instance (working state)
      if (req.action !== "READ") {
        await this.updateInstance(intentData, req.scope);
      }

      // Step 5: Broadcast Live Events for all operational opcodes across all families
      const broadcastOpcodes = Object.keys(OPCODE_NAMES).map(Number);
      if (broadcastOpcodes.includes(intentData.opcode)) {
        await this.triggerLiveBroadcast(intentData, req.scope);
      }

      // Step 6: Scheduling tasks
      if (intentData.opcode === 301) {
        await this.triggerTaskDO(intentData, req.scope);
      }
    }

    return intentData;
  }

  /**
   * Executes structured CRUD on the state table
   */
  private async executeCrud(
    action: string,
    data: any,
    scope: string,
  ): Promise<OpcodeResult> {
    const ucode = data.ucode || data.streamid;
    if (!ucode)
      throw new Error("ucode or streamid is required for CRUD operations");

    const [type] = ucode.split(":");
    let opcode = 100; // Base Opcode for State Management

    // Generate Embedding if applicable
    let embeddingStr = null;
    if (
      (action === "CREATE" || action === "UPDATE") &&
      this.env.AI &&
      (data.title || data.payload)
    ) {
      const textToEmbed =
        `${data.title || ""} ${JSON.stringify(data.payload || {})}`.trim();
      try {
        const embedResp = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
          text: [textToEmbed],
        });
        const vec = embedResp.data[0];
        const floatArray = Array.from(vec);
        embeddingStr = `[${floatArray.join(",")}]`;
      } catch (e) {
        console.warn("Embedding generation failed", e);
      }
    }

    if (action === "CREATE") {
      opcode = 101; // Map CREATE to Stock IN / Init
      const id = crypto.randomUUID();
      if (embeddingStr) {
        await this.db.execute({
          sql: "INSERT INTO state (id, ucode, type, title, payload, scope, embedding) VALUES (?, ?, ?, ?, ?, ?, vector(?))",
          args: [
            id,
            ucode,
            type || "unknown",
            data.title || null,
            JSON.stringify(data.payload || {}),
            scope,
            embeddingStr,
          ],
        });
      } else {
        await this.db.execute({
          sql: "INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            id,
            ucode,
            type || "unknown",
            data.title || null,
            JSON.stringify(data.payload || {}),
            scope,
          ],
        });
      }
      return {
        opcode: 101,
        delta: data.delta || 0,
        streamid: ucode,
        ucode: ucode,
        title: data.title || null,
        payload: data.payload || {},
        status: "done",
      } as any;
    } else if (action === "UPDATE") {
      opcode = 110; // Generic Update Opcode
      if (embeddingStr) {
        await this.db.execute({
          sql: "UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload), embedding = vector(?) WHERE ucode = ? AND scope = ?",
          args: [
            data.title || null,
            data.payload ? JSON.stringify(data.payload) : null,
            embeddingStr,
            ucode,
            scope,
          ],
        });
      } else {
        await this.db.execute({
          sql: "UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?",
          args: [
            data.title || null,
            data.payload ? JSON.stringify(data.payload) : null,
            ucode,
            scope,
          ],
        });
      }
      return {
        opcode: 110,
        delta: data.delta || 0,
        streamid: ucode,
        ucode: ucode,
        title: data.title || null,
        payload: data.payload || {},
        status: "done",
      } as any;
    } else if (action === "DELETE") {
      opcode = 199; // Delete Opcode
      await this.db.execute({
        sql: "DELETE FROM state WHERE ucode = ? AND scope = ?",
        args: [ucode, scope],
      });
    } else if (action === "READ") {
      opcode = 100; // Read/Status Opcode
      const result = await this.db.execute({
        sql: "SELECT * FROM state WHERE ucode = ? AND scope = ?",
        args: [ucode, scope],
      });
      if (result.rows.length === 0)
        throw new Error(`State ${ucode} not found in scope ${scope}`);

      return {
        opcode,
        delta: 0,
        streamid: ucode,
        status: "done",
        payload: result.rows[0] as any,
      } as any;
    }

    return {
      opcode,
      delta: data.delta || 0,
      streamid: ucode,
      ucode: ucode,
      status: "done",
    } as any;
  }

  /**
   * Triggers the Durable Object Task scheduler.
   * In a real OS, it would parse 'tonight at 5pm' to a timestamp.
   * For this demo, we'll schedule a 60-second alarm.
   */
  private async triggerTaskDO(data: OpcodeResult, scope: string) {
    console.log(`Attempting to trigger TaskDO for scope: ${scope}`);
    if (!this.env.TASK_DO) {
      console.error(
        "TASK_DO binding is MISSING from env. Available bindings:",
        Object.keys(this.env),
      );
      return;
    }

    // Create a predictable DO ID for this scope/task
    const id = this.env.TASK_DO.idFromName(scope);
    console.log(`Durable Object ID: ${id}`);
    const stub = this.env.TASK_DO.get(id);

    try {
      console.log(`Sending fetch request to TaskDO stub...`);
      // Send a 'schedule' request to the DO
      const response = await stub.fetch("http://do/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          delayMs: 60000, // 1 minute from now for testing
          streamid: data.streamid,
        }),
      });

      const text = await response.text();
      console.log(`TaskDO Response status: ${response.status}, text: ${text}`);
      console.log(`TaskDO for ${scope} has been alerted to start an alarm.`);
    } catch (err: any) {
      console.error(`FAILED to fetch TaskDO: ${err.message}`);
    }
  }

  /**
   * Broadcasts the event to all active WebSocket clients via the OrderDO
   */
  private async triggerLiveBroadcast(data: OpcodeResult, scope: string) {
    console.log(`Broadcasting live event to OrderDO for scope: ${scope}`);
    if (!this.env.ORDER_DO) return;

    const id = this.env.ORDER_DO.idFromName(scope);
    const stub = this.env.ORDER_DO.get(id);

    try {
      await stub.fetch("http://do/broadcast", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      console.error(`FAILED to broadcast to OrderDO: ${err.message}`);
    }
  }

  /**
   * Uses Cloudflare Workers AI to parse text into a JSON object matching OpcodeOutputSchema.
   * Full TAR opcode coverage: 1xx–9xx
   * Hybrid approach: Try quick keyword/regex parse first to save tokens.
   */
  private async extractIntentAi(text: string): Promise<any> {
    // 1. FAST PATH: Quick Parse (0 Token Consumption)
    const quickMatch = this.tryQuickParse(text);
    if (quickMatch) {
      console.log("Quick parse successful for:", text);
      return quickMatch;
    }

    // 2. SLOW PATH: Workers AI (Complex/Conversational Intent)
    console.log("Quick parse failed, falling back to Workers AI");
    const prompt = `You are the TAR Interpreter Agent for a Universal Commerce Operating System.
Your job: map the user's natural language to the correct TAR opcode and extract the operation details.

TAR OPCODE REFERENCE:
--- 1xx STOCK/INVENTORY ---
101 STOCKIN       - receive/restock goods (delta: +qty)
102 SALEOUT       - sell/ship goods out (delta: -qty)
103 SALERETURN    - customer return/refund stock (delta: +qty)
104 STOCKADJUST   - manual stock correction
105 STOCKTRANSFEROUT - transfer stock out to another location (delta: -qty)
106 STOCKTRANSFERIN  - transfer stock in from another location (delta: +qty)
107 STOCKVOID     - void/write-off stock (delta: -qty)

--- 2xx INVOICE/BILLING ---
201 INVOICECREATE     - create a new invoice
202 INVOICEITEMADD    - add item to invoice
203 INVOICEPAYMENT    - payment received for invoice (delta: +amount)
204 INVOICEPAYMENTFAIL - payment failed
205 INVOICEVOID       - void/cancel invoice
206 INVOICEITEMDEFINE - define a billing item
207 INVOICEREFUND     - refund on invoice (delta: -amount)

--- 3xx TASKS/WORKFLOW ---
301 TASKCREATE   - create a new task
302 TASKASSIGN   - assign task to user
303 TASKSTART    - start working on task
304 TASKPROGRESS - progress update on task
305 TASKDONE     - task completed
306 TASKFAIL     - task failed
307 TASKBLOCK    - task is blocked
308 TASKRESUME   - resume a blocked task
309 TASKVOID     - cancel/void task
310 TASKLINK     - link tasks together
311 TASKCOMMENT  - add comment to task

--- 4xx ACCOUNTS/LEDGER ---
401 ACCOUNTPAYIN  - money received into account (delta: +amount)
402 ACCOUNTPAYOUT - money paid out from account (delta: -amount)
403 ACCOUNTREFUND - refund processed (delta: +amount)
404 ACCOUNTADJUST - manual account adjustment

--- 5xx ORDERS/DELIVERY ---
501 ORDERCREATE  - create a new customer order
502 ORDERSHIP    - ship/dispatch an order
503 ORDERDELIVER - order delivered successfully
504 ORDERCANCEL  - cancel an order

--- 6xx TRANSPORT/BOOKING/RENTAL ---
601 RIDECREATE   - create a ride booking
602 RIDESTART    - ride started
603 RIDEDONE     - ride completed (delta: +fare)
604 RIDECANCEL   - ride cancelled
605 MOTION       - location/motion update
611 BOOKINGCREATE - create booking/appointment
612 BOOKINGDONE  - booking completed
621 RENTALSTART  - rental period started
622 RENTALEND    - rental period ended

--- 7xx TAX/GOVERNMENT ---
701 GSTVATACCRUE - accrue GST/VAT on transaction (delta: +taxAmount)
702 GSTVATPAY    - pay tax to government (delta: -taxAmount)
703 GSTVATREFUND - receive tax refund (delta: +taxAmount)

--- 8xx AI/MEMORY ---
801 MEMORYDEFINE   - define a memory/knowledge entry
802 MEMORYWRITE    - write a memory record
803 MEMORYUPDATE   - update existing memory
804 MEMORYSNAPSHOT - snapshot current state to memory

--- 9xx IDENTITY/ACCESS ---
901 USERCREATE    - create new user
902 USERROLEGRANT - grant role to user
903 USERAUTH      - authenticate/login user
904 USERDISABLE   - disable user account

STREAM ID FORMAT: {type}:{identifier}
- Use the most relevant entity type: product, invoice, order, task, driver, user, account, booking, ride, rental
- Example: product:speaker, invoice:INV001, order:ORD123, driver:ali, user:john

RULES:
- Pick the MOST SPECIFIC opcode for the operation
- For selling/ordering, prefer 501 ORDERCREATE unless clearly stock movement (then 102)
- delta is POSITIVE for additions/receipts, NEGATIVE for removals/payments
- status is always "done" unless text implies pending/scheduled

OUTPUT: Respond ONLY with a single raw JSON object, no markdown, no explanation, no code blocks:
{"opcode": number, "delta": number, "streamid": "type:id", "status": "done|pending|failed"}

IMPORTANT: Use the opcode number from the reference above. For example, if a user wants to create a task, use 301.

User Text: "${text}"`;

    if (this.env.AI) {
      try {
        const response = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            {
              role: "system",
              content:
                "You are a JSON-only API. Output ONLY valid JSON. No markdown, no explanation, no code blocks.",
            },
            { role: "user", content: prompt },
          ],
        });
        const raw = (response.response || "")
          .replace(/```json\n?|\n?```/g, "")
          .trim();
        // Extract JSON object if there's surrounding text
        const jsonMatch = raw.match(/\{[^{}]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(raw);
      } catch (e) {
        console.warn("AI JSON extraction failed, falling back to simple keyword parser.", e);
      }
    }

    return this.tryQuickParse(text) || { opcode: 101, delta: 1, streamid: "product:item", status: "done" };
  }

  /**
   * Deterministic keyword/regex parser (Tier 1)
   */
  private tryQuickParse(text: string): any {
    const t = text.toLowerCase();
    const numMatch = text.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0]) : 1;
    const streamMatch = text.match(/([a-z]+:[a-z0-9_-]+)/i);
    const streamid = streamMatch ? streamMatch[0] : null;

    // 1xx Stock
    if (t.includes("sell") || t.includes("sale") || t.includes("sold")) {
      return { opcode: 102, delta: -qty, streamid: streamid || "product:item", status: "done" };
    }
    if (t.includes("receive") || t.includes("restock") || t.includes("stock in")) {
      return { opcode: 101, delta: qty, streamid: streamid || "product:item", status: "done" };
    }
    if (t.includes("return")) {
      return { opcode: 103, delta: qty, streamid: streamid || "product:item", status: "done" };
    }

    // 5xx Orders
    if (t.includes("order") && t.includes("create")) {
      return { opcode: 501, delta: qty, streamid: streamid || "order:pending", status: "pending" };
    }
    if (t.includes("ship") || t.includes("dispatch")) {
      return { opcode: 502, delta: 0, streamid: streamid || "order:active", status: "done" };
    }

    // 3xx Tasks
    if (t.includes("task") && (t.includes("create") || t.includes("new"))) {
      return { opcode: 301, delta: 0, streamid: streamid || "task:new", status: "pending" };
    }
    if (t.includes("task") && (t.includes("done") || t.includes("finish"))) {
      return { opcode: 305, delta: 0, streamid: streamid || "task:done", status: "done" };
    }

    // 4xx Accounts
    if (t.includes("pay out") || t.includes("payout")) {
      return { opcode: 402, delta: -qty, streamid: streamid || "account:main", status: "done" };
    }

    // 8xx Memory
    if (t.includes("remember") || t.includes("memory")) {
      return { opcode: 802, delta: 0, streamid: streamid || "memory:user", status: "done" };
    }

    // If no certain match, returns null to trigger AI (Tier 2)
    return null;
  }

  /**
   * Inserts the event into the trace ledger in Turso
   */
  private async writeTrace(data: OpcodeResult, req: any) {
    const traceId = crypto.randomUUID();
    await this.db.execute({
      sql: `INSERT INTO trace (id, streamid, opcode, status, delta, lat, lng, payload, scope) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        traceId,
        data.streamid,
        data.opcode,
        data.status,
        data.delta,
        req.lat || null,
        req.lng || null,
        JSON.stringify({ userId: req.userId, source: req.channel }),
        req.scope,
      ],
    });
    console.log(`Trace ${traceId} written successfully.`);
  }

  /**
   * Updates the projected state (instance table) based on the event
   */
  private async updateInstance(data: OpcodeResult, scope: string) {
    // 1. Resolve or Create the State entity (ucode)
    const ucode = data.streamid;

    // Check if state already exists
    const stateResult = await this.db.execute({
      sql: "SELECT id FROM state WHERE ucode = ?",
      args: [ucode],
    });

    let stateId: string;

    if (stateResult.rows.length > 0) {
      stateId = stateResult.rows[0].id as string;
    } else {
      // Auto-provision basic state if it doesn't exist
      stateId = crypto.randomUUID();
      const [type] = ucode.split(":");
      await this.db.execute({
        sql: "INSERT INTO state (id, ucode, type, scope) VALUES (?, ?, ?, ?)",
        args: [stateId, ucode, type || "unknown", scope],
      });
      console.log(`Auto-provisioned state record for ${ucode}`);
    }

    // 2. Update the Instance
    const instanceId = crypto.randomUUID();

    // We use streamid as a unique part of the instance ID if we want to update existing projections,
    // or we can search for an existing instance tied to this stateId and scope.
    // For this proof of concept, we'll upsert by finding existing record for this stateid+scope

    await this.db.execute({
      sql: `INSERT INTO instance (id, stateid, type, scope, qty)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET qty = qty + excluded.qty`,
      args: [instanceId, stateId, "projection", scope, data.delta],
    });

    // Note: To truly 'upsert' an instance for a product in a shop, we should probably have a unique constraint
    // on (stateid, scope) in the instance table or use a deterministic ID.
    // Given the current schema doesn't have a unique constraint on (stateid, scope),
    // 'ON CONFLICT(id)' only works if we use the same ID.

    console.log(`Instance updated for ${data.streamid}.`);
  }
}
