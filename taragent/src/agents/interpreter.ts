import type { Client } from "@libsql/client";
import { z } from "zod";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

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
  private env: any;

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
    channel?: string;
    action?: "CREATE" | "READ" | "UPDATE" | "DELETE" | "SEARCH";
    data?: Record<string, any>;
    lat?: number;
    lng?: number;
  }) {
    console.log(`Processing ${req.action || "intent"} for scope ${req.scope}`);

    let intentData: OpcodeResult;
    const isDirectCrud = !!(req.action && req.data);

    if (isDirectCrud) {
      intentData = await this.executeCrud(req.action!, req.data!, req.scope);
    } else if (req.text) {
      const aiOutput = await this.extractIntentAi(req.text);
      const parsedIntent = OpcodeOutputSchema.safeParse(aiOutput);
      if (!parsedIntent.success) {
        console.error("AI output failed schema validation", parsedIntent.error);
        throw new Error("Failed to understand intent structurally");
      }
      intentData = parsedIntent.data;
      intentData.opname = OPCODE_NAMES[intentData.opcode] || "UNKNOWN";
    } else {
      throw new Error("Invalid request: missing text or action");
    }

    if (!isDirectCrud) {
      // Write to events ledger
      await this.writeEvents(intentData, req);

      // Update instance projection
      if (req.action !== "READ") {
        await this.updateInstance(intentData, req.scope);
      }

      // Broadcast live events
      const broadcastOpcodes = Object.keys(OPCODE_NAMES).map(Number);
      if (broadcastOpcodes.includes(intentData.opcode)) {
        await this.triggerLiveBroadcast(intentData, req.scope);
      }
    }

    return intentData;
  }

  private async executeCrud(
    action: string,
    data: any,
    scope: string,
  ): Promise<OpcodeResult> {
    const ucode = data.ucode || data.streamid;
    if (!ucode)
      throw new Error("ucode or streamid is required for CRUD operations");

    if (action === "CREATE") {
      return {
        opcode: 101,
        delta: data.delta || 0,
        streamid: ucode,
        status: "done",
      } as any;
    } else if (action === "UPDATE") {
      return {
        opcode: 110,
        delta: data.delta || 0,
        streamid: ucode,
        status: "done",
      } as any;
    } else if (action === "DELETE") {
      return {
        opcode: 199,
        delta: 0,
        streamid: ucode,
        status: "done",
      } as any;
    } else if (action === "READ") {
      return {
        opcode: 100,
        delta: 0,
        streamid: ucode,
        status: "done",
      } as any;
    }

    return {
      opcode: 100,
      delta: data.delta || 0,
      streamid: ucode,
      status: "done",
    } as any;
  }

  private async triggerLiveBroadcast(data: OpcodeResult, scope: string) {
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
   * Uses Groq to parse text into a JSON object matching OpcodeOutputSchema.
   * Hybrid approach: Try quick keyword/regex parse first to save tokens.
   */
  private async extractIntentAi(text: string): Promise<any> {
    // 1. FAST PATH: Quick Parse
    const quickMatch = this.tryQuickParse(text);
    if (quickMatch) {
      console.log("Quick parse successful for:", text);
      return quickMatch;
    }

    // 2. SLOW PATH: Groq LLM
    console.log("Quick parse failed, falling back to Groq");

    if (this.env.GROQ_API_KEY) {
      try {
        const groq = createGroq({ apiKey: this.env.GROQ_API_KEY });
        const { text: responseText } = await generateText({
          model: groq("llama-3.3-70b-versatile"),
          system: "You are a JSON-only API. Output ONLY valid JSON. No markdown, no explanation, no code blocks.",
          prompt: this.buildIntentPrompt(text),
        });

        const raw = (responseText || "").replace(/```json\n?|\n?```/g, "").trim();
        const jsonMatch = raw.match(/\{[^{}]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(raw);
      } catch (e) {
        console.warn("Groq JSON extraction failed, falling back to keyword parser.", e);
      }
    }

    return this.tryQuickParse(text) || { opcode: 101, delta: 1, streamid: "product:item", status: "done" };
  }

  private buildIntentPrompt(text: string): string {
    return `You are the TAR Interpreter Agent for a Universal Commerce Operating System.
Your job: map the user's natural language to the correct TAR opcode and extract the operation details.

TAR OPCODE REFERENCE:
--- 1xx STOCK/INVENTORY ---
101 STOCKIN       - receive/restock goods (delta: +qty)
102 SALEOUT       - sell/ship goods out (delta: -qty)
103 SALERETURN    - customer return/refund stock (delta: +qty)
104 STOCKADJUST   - manual stock correction
105 STOCKTRANSFEROUT - transfer stock out (delta: -qty)
106 STOCKTRANSFERIN  - transfer stock in (delta: +qty)
107 STOCKVOID     - void/write-off stock (delta: -qty)

--- 2xx INVOICE/BILLING ---
201 INVOICECREATE     - create a new invoice
202 INVOICEITEMADD    - add item to invoice
203 INVOICEPAYMENT    - payment received (delta: +amount)
204 INVOICEPAYMENTFAIL - payment failed
205 INVOICEVOID       - void/cancel invoice
206 INVOICEITEMDEFINE - define a billing item
207 INVOICEREFUND     - refund on invoice (delta: -amount)

--- 3xx TASKS/WORKFLOW ---
301 TASKCREATE   - create a new task
302 TASKASSIGN   - assign task to user
303 TASKSTART    - start working on task
304 TASKPROGRESS - progress update
305 TASKDONE     - task completed
306 TASKFAIL     - task failed
307 TASKBLOCK    - task is blocked
308 TASKRESUME   - resume blocked task
309 TASKVOID     - cancel/void task
310 TASKLINK     - link tasks
311 TASKCOMMENT  - add comment

--- 4xx ACCOUNTS/LEDGER ---
401 ACCOUNTPAYIN  - money received (delta: +amount)
402 ACCOUNTPAYOUT - money paid out (delta: -amount)
403 ACCOUNTREFUND - refund processed (delta: +amount)
404 ACCOUNTADJUST - manual adjustment

--- 5xx ORDERS/DELIVERY ---
501 ORDERCREATE  - create order
502 ORDERSHIP    - ship/dispatch
503 ORDERDELIVER - delivered
504 ORDERCANCEL  - cancel order

--- 6xx TRANSPORT ---
601 RIDECREATE / 602 RIDESTART / 603 RIDEDONE / 604 RIDECANCEL
605 MOTION / 611 BOOKINGCREATE / 612 BOOKINGDONE / 621 RENTALSTART / 622 RENTALEND

--- 7xx TAX ---
701 GSTVATACCRUE / 702 GSTVATPAY / 703 GSTVATREFUND

--- 8xx MEMORY ---
801 MEMORYDEFINE / 802 MEMORYWRITE / 803 MEMORYUPDATE / 804 MEMORYSNAPSHOT

--- 9xx IDENTITY ---
901 USERCREATE / 902 USERROLEGRANT / 903 USERAUTH / 904 USERDISABLE

STREAM ID FORMAT: {type}:{identifier}

OUTPUT: Respond ONLY with a single raw JSON object:
{"opcode": number, "delta": number, "streamid": "type:id", "status": "done|pending|failed"}

User Text: "${text}"`;
  }

  private tryQuickParse(text: string): any {
    const t = text.toLowerCase();
    const numMatch = text.match(/\d+/);
    const qty = numMatch ? parseInt(numMatch[0]) : 1;
    const streamMatch = text.match(/([a-z]+:[a-z0-9_-]+)/i);
    const streamid = streamMatch ? streamMatch[0] : null;

    if (t.includes("sell") || t.includes("sale") || t.includes("sold")) {
      return { opcode: 102, delta: -qty, streamid: streamid || "product:item", status: "done" };
    }
    if (t.includes("receive") || t.includes("restock") || t.includes("stock in")) {
      return { opcode: 101, delta: qty, streamid: streamid || "product:item", status: "done" };
    }
    if (t.includes("return")) {
      return { opcode: 103, delta: qty, streamid: streamid || "product:item", status: "done" };
    }
    if (t.includes("order") && t.includes("create")) {
      return { opcode: 501, delta: qty, streamid: streamid || "order:pending", status: "pending" };
    }
    if (t.includes("ship") || t.includes("dispatch")) {
      return { opcode: 502, delta: 0, streamid: streamid || "order:active", status: "done" };
    }
    if (t.includes("task") && (t.includes("create") || t.includes("new"))) {
      return { opcode: 301, delta: 0, streamid: streamid || "task:new", status: "pending" };
    }
    if (t.includes("task") && (t.includes("done") || t.includes("finish"))) {
      return { opcode: 305, delta: 0, streamid: streamid || "task:done", status: "done" };
    }
    if (t.includes("pay out") || t.includes("payout")) {
      return { opcode: 402, delta: -qty, streamid: streamid || "account:main", status: "done" };
    }
    if (t.includes("remember") || t.includes("memory")) {
      return { opcode: 802, delta: 0, streamid: streamid || "memory:user", status: "done" };
    }

    return null;
  }

  private async writeEvents(data: OpcodeResult, req: any) {
    const eventId = crypto.randomUUID();
    await this.db.execute({
      sql: `INSERT INTO events (id, streamid, opcode, status, delta, lat, lng, payload, scope)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        eventId,
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
    console.log(`Event ${eventId} written successfully.`);
  }

  private async updateInstance(data: OpcodeResult, scope: string) {
    const ucode = data.streamid;
    const instanceId = crypto.randomUUID();
    await this.db.execute({
      sql: `INSERT INTO instance (id, stateid, type, scope, qty, ts)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET qty = qty + excluded.qty, ts = CURRENT_TIMESTAMP`,
      args: [instanceId, ucode, "projection", scope, data.delta],
    });
    console.log(`Instance projected for ${data.streamid} (delta: ${data.delta})`);
  }
}
