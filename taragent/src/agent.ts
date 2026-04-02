import { createGroq } from "@ai-sdk/groq";
import { callable, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { getStatesDbClient, getInstancesDbClient } from "./db/client";
import { InterpreterAgent } from "./agents/interpreter";
import { SearchAgent } from "./agents/search";
import { DesignAgent } from "./agents/design";
import { AnalyticsAgent } from "./agents/analytics";

// ─── Constants ───

const DEFAULT_SCOPE = "shop:main";
const DEFAULT_CURRENCY = "INR";
const MAX_TOOL_STEPS = 5;

// ─── Tool builder helpers ───

function scopeParam() {
  return z.string().default(DEFAULT_SCOPE).describe("Store scope");
}

// ─── TarAgent ───

export class TarAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;

  // ─── Internal helpers ───

  private groq() {
    return createGroq({ apiKey: this.env.GROQ_API_KEY });
  }

  private statesDb() {
    return getStatesDbClient(this.env.STATES_DB_URL, this.env.STATES_DB_TOKEN);
  }

  private instancesDb() {
    return getInstancesDbClient(this.env.INSTANCES_DB_URL, this.env.INSTANCES_DB_TOKEN);
  }

  private orderStub(scope: string) {
    return this.env.ORDER_DO.get(this.env.ORDER_DO.idFromName(scope));
  }

  private extractSlug(text: string): string {
    const patterns = [
      /(?:called|named|name\s*:|name)\s+([a-zA-Z0-9-]+)/i,
      /(?:brand|by)\s+([a-zA-Z0-9-]+)/i,
      /([a-zA-Z0-9-]+)\s+(?:store|shop|bakery|cafe|restaurant|site)/i,
      /(?:store|shop|bakery|cafe|restaurant|brand|site)\s+([a-zA-Z0-9-]+)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    }
    const stopWords = ["create", "design", "build", "make", "setup", "my", "the", "for", "store", "shop"];
    const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w));
    return words[0] || "mystore";
  }

  // ─── Chat handler ───

  async onChatMessage(
    _onFinish?: unknown,
    options?: OnChatMessageOptions,
  ) {
    const result = streamText({
      model: this.groq()("llama-3.3-70b-versatile"),
      system: `You are TarAgent, the AI assistant for TAR — a Universal Commerce Operating System.
You help users manage their store: inventory, orders, invoices, tasks, design, analytics, and more.
You have tools for CRUD on states and instances, event management, storefront design, search, scheduling, and analytics.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the scheduleTask tool.
If the user asks about their store, inventory, orders — use the appropriate tools.
If the user wants to design or update their storefront, use the design tools.`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
      }),
      tools: this.buildTools(),
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
  }

  // ─── Tool definitions ───

  private buildTools() {
    return {
      // ── State CRUD ──
      createState: tool({
        description: "Create a new state record (product, service, etc.)",
        inputSchema: z.object({
          ucode: z.string().describe("Unique code like 'product:coffee'"),
          title: z.string().optional(),
          payload: z.record(z.string(), z.any()).optional(),
          scope: scopeParam(),
          userid: z.string().optional().describe("User ID of the creator"),
          public: z.boolean().optional().describe("Whether this state is publicly discoverable"),
        }),
        execute: async ({ ucode, title, payload, scope, userid, public: isPublic }) => {
          const db = this.statesDb();
          const [type] = ucode.split(":");
          const id = crypto.randomUUID();
          await db.execute({
            sql: "INSERT INTO state (id, ucode, type, title, payload, scope, userid, public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            args: [id, ucode, type || "unknown", title || null, JSON.stringify(payload || {}), scope, userid || null, isPublic ? 1 : 0],
          });
          return { success: true, id, ucode, title, scope };
        },
      }),

      updateState: tool({
        description: "Update an existing state record",
        inputSchema: z.object({
          ucode: z.string(),
          title: z.string().optional(),
          payload: z.record(z.string(), z.any()).optional(),
          scope: scopeParam(),
        }),
        execute: async ({ ucode, title, payload, scope }) => {
          const db = this.statesDb();
          await db.execute({
            sql: "UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?",
            args: [title || null, payload ? JSON.stringify(payload) : null, ucode, scope],
          });
          return { success: true, ucode, updated: true };
        },
      }),

      deleteState: tool({
        description: "Delete a state record by ucode",
        inputSchema: z.object({ ucode: z.string(), scope: scopeParam() }),
        execute: async ({ ucode, scope }) => {
          const db = this.statesDb();
          await db.execute({
            sql: "DELETE FROM state WHERE ucode = ? AND scope = ?",
            args: [ucode, scope],
          });
          return { success: true, ucode, deleted: true };
        },
      }),

      getState: tool({
        description: "Get a single state record by ucode",
        inputSchema: z.object({ ucode: z.string(), scope: scopeParam() }),
        execute: async ({ ucode, scope }) => {
          const db = this.statesDb();
          const result = await db.execute({
            sql: "SELECT id, ucode, type, title, payload, scope, userid, public, ts FROM state WHERE ucode = ? AND scope = ?",
            args: [ucode, scope],
          });
          return result.rows.length > 0 ? result.rows[0] : { error: "Not found" };
        },
      }),

      listStates: tool({
        description: "List state records, optionally filtered by type",
        inputSchema: z.object({
          scope: scopeParam(),
          type: z.string().optional(),
          limit: z.number().default(50),
        }),
        execute: async ({ scope, type, limit }) => {
          const db = this.statesDb();
          let sql = "SELECT id, ucode, type, title, payload, scope, userid, public FROM state WHERE scope = ?";
          const args: any[] = [scope];
          if (type) { sql += " AND type = ?"; args.push(type); }
          sql += " ORDER BY ts DESC LIMIT ?";
          args.push(limit);
          return (await db.execute({ sql, args })).rows;
        },
      }),

      listPublicStates: tool({
        description: "List public state records across all scopes, optionally filtered by type",
        inputSchema: z.object({
          type: z.string().optional(),
          q: z.string().optional().describe("Search query to filter by title"),
          limit: z.number().default(50),
        }),
        execute: async ({ type, q, limit }) => {
          const db = this.statesDb();
          let sql = "SELECT id, ucode, type, title, payload, scope, userid, ts FROM state WHERE public = 1";
          const args: any[] = [];
          if (type) { sql += " AND type = ?"; args.push(type); }
          if (q) { sql += " AND title LIKE ?"; args.push(`%${q}%`); }
          sql += " ORDER BY ts DESC LIMIT ?";
          args.push(limit);
          return (await db.execute({ sql, args })).rows;
        },
      }),

      // ── Instance CRUD ──
      createInstance: tool({
        description: "Create a new instance (inventory item, working state)",
        inputSchema: z.object({
          stateid: z.string(),
          type: z.string().default("inventory"),
          scope: scopeParam(),
          qty: z.number().optional(),
          value: z.number().optional(),
          currency: z.string().default(DEFAULT_CURRENCY),
          available: z.boolean().default(true),
          payload: z.record(z.string(), z.any()).optional(),
        }),
        execute: async ({ stateid, type, scope, qty, value, currency, available, payload }) => {
          const db = this.instancesDb();
          const id = crypto.randomUUID();
          await db.execute({
            sql: `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, ts, payload)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [id, stateid, type, scope, qty ?? null, value ?? null, currency, available ? 1 : 0, new Date().toISOString(), payload ? JSON.stringify(payload) : null],
          });
          return { success: true, id, stateid, scope };
        },
      }),

      getInstances: tool({
        description: "Get instances by stateid",
        inputSchema: z.object({ stateid: z.string(), scope: scopeParam() }),
        execute: async ({ stateid, scope }) => {
          const db = this.instancesDb();
          return (await db.execute({
            sql: "SELECT * FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC",
            args: [stateid, scope],
          })).rows;
        },
      }),

      updateInstance: tool({
        description: "Update an instance by ID",
        inputSchema: z.object({
          id: z.string(),
          qty: z.number().optional(),
          value: z.number().optional(),
          available: z.boolean().optional(),
          payload: z.record(z.string(), z.any()).optional(),
        }),
        execute: async ({ id, qty, value, available, payload }) => {
          const db = this.instancesDb();
          const fields: string[] = [];
          const values: any[] = [];
          if (qty !== undefined) { fields.push("qty = ?"); values.push(qty); }
          if (value !== undefined) { fields.push("value = ?"); values.push(value); }
          if (available !== undefined) { fields.push("available = ?"); values.push(available ? 1 : 0); }
          if (payload !== undefined) { fields.push("payload = ?"); values.push(JSON.stringify(payload)); }
          if (fields.length === 0) return { error: "No fields to update" };
          values.push(id);
          await db.execute({ sql: `UPDATE instance SET ${fields.join(", ")} WHERE id = ?`, args: values });
          return { success: true, id, updated: true };
        },
      }),

      deleteInstance: tool({
        description: "Delete an instance by ID",
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          const db = this.instancesDb();
          await db.execute({ sql: "DELETE FROM instance WHERE id = ?", args: [id] });
          return { success: true, id, deleted: true };
        },
      }),

      // ── Embeddings / Search ──
      upsertEmbedding: tool({
        description: "Store an embedding vector for a state",
        inputSchema: z.object({
          stateId: z.string(),
          vector: z.array(z.number()).length(384),
        }),
        execute: async ({ stateId, vector }) => {
          const db = this.statesDb();
          await db.execute({
            sql: "INSERT OR REPLACE INTO stateai (state_id, embedding) VALUES (?, vector32(?))",
            args: [stateId, JSON.stringify(vector)],
          });
          return { success: true, stateId, stored: true };
        },
      }),

      searchEmbeddings: tool({
        description: "Semantic search using a query vector",
        inputSchema: z.object({
          vector: z.array(z.number()).length(384),
          scope: scopeParam(),
          limit: z.number().default(10),
        }),
        execute: async ({ vector, scope, limit }) => {
          const db = this.statesDb();
          return (await db.execute({
            sql: `SELECT s.id, s.ucode, s.type, s.title, s.payload, s.scope,
                  vector_distance_cos(e.embedding, vector32(?)) as distance
                  FROM state s JOIN stateai e ON s.id = e.state_id
                  WHERE s.scope = ? ORDER BY distance ASC LIMIT ?`,
            args: [JSON.stringify(vector), scope, limit],
          })).rows;
        },
      }),

      // ── Events ──
      emitEvent: tool({
        description: "Emit a cloud event to OrderDO for persistence and broadcast",
        inputSchema: z.object({
          opcode: z.number().min(101).max(999),
          streamid: z.string(),
          delta: z.number().default(0),
          payload: z.record(z.string(), z.any()).optional(),
          scope: scopeParam(),
        }),
        execute: async ({ opcode, streamid, delta, payload, scope }) => {
          const stub = this.orderStub(scope);
          const event = { opcode, streamid, delta, payload: payload || {}, scope, timestamp: new Date().toISOString() };
          const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, {
            method: "POST",
            body: JSON.stringify(event),
          }));
          return { success: true, event, ...(await response.json() as object) };
        },
      }),

      getEvents: tool({
        description: "Get recent events for a scope",
        inputSchema: z.object({ scope: scopeParam(), limit: z.number().default(50) }),
        execute: async ({ scope, limit }) => {
          const stub = this.orderStub(scope);
          const response = await stub.fetch(new Request(`http://localhost/api/events?limit=${limit}&scope=${scope}`));
          return await response.json();
        },
      }),

      deleteEvent: tool({
        description: "Delete an event by ID",
        inputSchema: z.object({ eventId: z.string(), scope: scopeParam() }),
        execute: async ({ eventId, scope }) => {
          const stub = this.orderStub(scope);
          const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "DELETE" }));
          return await response.json();
        },
      }),

      updateEvent: tool({
        description: "Update an event by ID",
        inputSchema: z.object({
          eventId: z.string(),
          scope: scopeParam(),
          opcode: z.number().optional(),
          streamid: z.string().optional(),
          delta: z.number().optional(),
          payload: z.record(z.string(), z.any()).optional(),
        }),
        execute: async ({ eventId, scope, ...body }) => {
          const stub = this.orderStub(scope);
          const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, {
            method: "PUT",
            body: JSON.stringify(body),
          }));
          return await response.json();
        },
      }),

      // ── Design ──
      generateDesign: tool({
        description: "Generate a storefront design for a scope",
        inputSchema: z.object({
          text: z.string().describe("Description of the store to design"),
          scope: scopeParam(),
          userId: z.string().default("agent"),
        }),
        execute: async ({ text, scope, userId }) => {
          const designAgent = new DesignAgent(this.statesDb(), this.env);
          if (scope === DEFAULT_SCOPE && text) {
            scope = `shop:${this.extractSlug(text)}`;
          }
          return await designAgent.generateDesign({ text, scope, userId });
        },
      }),

      updateDesign: tool({
        description: "Update an existing storefront design",
        inputSchema: z.object({
          text: z.string(),
          scope: z.string(),
          userId: z.string().default("agent"),
        }),
        execute: async ({ text, scope, userId }) => {
          const designAgent = new DesignAgent(this.statesDb(), this.env);
          return await designAgent.updateDesign({ text, scope, userId });
        },
      }),

      getDesignHistory: tool({
        description: "Get design snapshot history for a scope",
        inputSchema: z.object({ scope: z.string(), limit: z.number().default(10) }),
        execute: async ({ scope, limit }) => {
          const stub = this.orderStub(scope);
          const response = await stub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
          if (!response.ok) return { error: "Failed to fetch events" };
          const allEvents: any[] = await response.json();
          return allEvents
            .filter((e: any) => e.opcode === 813 && e.payload?.storeConfig)
            .slice(0, limit)
            .map((e: any) => ({ id: e.id, ts: e.ts, scope: e.scope }));
        },
      }),

      revertDesign: tool({
        description: "Revert storefront design to a previous snapshot",
        inputSchema: z.object({ eventId: z.string(), scope: z.string() }),
        execute: async ({ eventId, scope }) => {
          const stub = this.orderStub(scope);
          const response = await stub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
          if (!response.ok) return { error: "Failed to fetch events" };
          const allEvents: any[] = await response.json();
          const snapshot = allEvents.find((e: any) => e.id === eventId && e.opcode === 813 && e.payload?.storeConfig);
          if (!snapshot) return { error: "Snapshot not found" };
          const designAgent = new DesignAgent(this.statesDb(), this.env);
          return await designAgent.revertDesign({ snapshotPayload: snapshot.payload, scope });
        },
      }),

      // ── NL Intent ──
      interpretIntent: tool({
        description: "Interpret natural language into a TAR opcode operation",
        inputSchema: z.object({
          text: z.string(),
          scope: scopeParam(),
          userId: z.string().default("agent"),
        }),
        execute: async ({ text, scope, userId }) => {
          const interpreter = new InterpreterAgent(this.instancesDb(), this.env);
          return await interpreter.processIntent({ text, scope, userId, channel: "agent" });
        },
      }),

      // ── Analytics ──
      generateReport: tool({
        description: "Generate a daily analytics report for a scope",
        inputSchema: z.object({ scope: scopeParam() }),
        execute: async ({ scope }) => {
          const analytics = new AnalyticsAgent(this.instancesDb());
          return await analytics.generateDailyReport(scope);
        },
      }),

      // ── Scheduling ──
      scheduleTask: tool({
        description: "Schedule a task to be executed later",
        inputSchema: scheduleSchema,
        execute: async ({ when, description }) => {
          if (when.type === "no-schedule") return "Not a valid schedule input";
          const input = when.type === "scheduled" ? when.date
            : when.type === "delayed" ? when.delayInSeconds
            : when.type === "cron" ? when.cron : null;
          if (!input) return "Invalid schedule type";
          this.schedule(input, "executeTask", description, { idempotent: true });
          return `Task scheduled: "${description}" (${when.type}: ${input})`;
        },
      }),

      getScheduledTasks: tool({
        description: "List all scheduled tasks",
        inputSchema: z.object({}),
        execute: async () => {
          const tasks = this.getSchedules();
          return tasks.length > 0 ? tasks : "No scheduled tasks found.";
        },
      }),

      cancelScheduledTask: tool({
        description: "Cancel a scheduled task by ID",
        inputSchema: z.object({ taskId: z.string() }),
        execute: async ({ taskId }) => {
          this.cancelSchedule(taskId);
          return `Task ${taskId} cancelled.`;
        },
      }),
    };
  }

  // ─── Scheduled task execution ───

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString(),
      })
    );
  }

  // ─── @callable() methods for REST compat ───

  @callable()
  async callCreateState(args: { ucode: string; title?: string; payload?: Record<string, any>; scope?: string; userid?: string; public?: boolean }) {
    const db = this.statesDb();
    const [type] = args.ucode.split(":");
    const id = crypto.randomUUID();
    const scope = args.scope || DEFAULT_SCOPE;
    await db.execute({
      sql: "INSERT INTO state (id, ucode, type, title, payload, scope, userid, public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, args.ucode, type || "unknown", args.title || null, JSON.stringify(args.payload || {}), scope, args.userid || null, args.public ? 1 : 0],
    });
    return { success: true, result: { id, ucode: args.ucode, title: args.title, scope } };
  }

  @callable()
  async callUpdateState(args: { ucode: string; title?: string; payload?: Record<string, any>; scope?: string }) {
    const db = this.statesDb();
    const scope = args.scope || DEFAULT_SCOPE;
    await db.execute({
      sql: "UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?",
      args: [args.title || null, args.payload ? JSON.stringify(args.payload) : null, args.ucode, scope],
    });
    return { success: true, result: { ucode: args.ucode, updated: true } };
  }

  @callable()
  async callGetStates(args: { scope?: string; type?: string; limit?: number }) {
    const db = this.statesDb();
    const scope = args.scope || DEFAULT_SCOPE;
    let sql = "SELECT id, ucode, type, title, payload, scope, userid, public FROM state WHERE scope = ?";
    const sqlArgs: any[] = [scope];
    if (args.type) { sql += " AND type = ?"; sqlArgs.push(args.type); }
    sql += " ORDER BY ts DESC LIMIT ?";
    sqlArgs.push(args.limit || 50);
    return { success: true, result: (await db.execute({ sql, args: sqlArgs })).rows };
  }

  @callable()
  async callCreateInstance(args: {
    stateid: string; type?: string; scope?: string; qty?: number; value?: number;
    currency?: string; available?: boolean; payload?: Record<string, any>;
  }) {
    const db = this.instancesDb();
    const id = crypto.randomUUID();
    const scope = args.scope || DEFAULT_SCOPE;
    await db.execute({
      sql: `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, ts, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, args.stateid, args.type || "inventory", scope, args.qty ?? null, args.value ?? null, args.currency || DEFAULT_CURRENCY, args.available !== false ? 1 : 0, new Date().toISOString(), args.payload ? JSON.stringify(args.payload) : null],
    });
    return { success: true, result: { id, stateid: args.stateid, scope } };
  }

  @callable()
  async callGetInstances(args: { stateid: string; scope?: string }) {
    const db = this.instancesDb();
    const scope = args.scope || DEFAULT_SCOPE;
    return { success: true, result: (await db.execute({
      sql: "SELECT * FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC",
      args: [args.stateid, scope],
    })).rows };
  }

  @callable()
  async callEmitEvent(args: { opcode: number; streamid: string; delta?: number; payload?: Record<string, any>; scope?: string }) {
    const scope = args.scope || DEFAULT_SCOPE;
    const stub = this.orderStub(scope);
    const event = { opcode: args.opcode, streamid: args.streamid, delta: args.delta || 0, payload: args.payload || {}, scope, timestamp: new Date().toISOString() };
    const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, { method: "POST", body: JSON.stringify(event) }));
    return { success: true, result: { emitted: true, event, ...(await response.json() as object) } };
  }

  @callable()
  async callChannel(args: {
    channel: string; userId: string; scope: string; text?: string;
    action?: "SEARCH" | "DESIGN" | "DESIGN_UPDATE"; data?: Record<string, any>;
  }) {
    const scope = args.scope || DEFAULT_SCOPE;

    // Route to Search
    if ((args.action === "SEARCH" || args.text?.toLowerCase().startsWith("search")) && args.text) {
      const searchAgent = new SearchAgent(this.statesDb(), this.env);
      const result = await searchAgent.processSearch(args.text, scope);
      return { success: true, result: { ...result, action: "SEARCH" } };
    }

    // Route to Design
    const isDesign = args.action === "DESIGN" || args.action === "DESIGN_UPDATE" ||
      (args.text && /^(design|create|build|setup)\s+(my\s+)?(store|shop|site|storefront)/i.test(args.text));

    if (isDesign) {
      const designAgent = new DesignAgent(this.statesDb(), this.env);
      let designScope = scope;
      const action = args.action || "DESIGN";

      if (action !== "DESIGN_UPDATE" && designScope === DEFAULT_SCOPE && args.text) {
        designScope = `shop:${this.extractSlug(args.text)}`;
      }

      if (action === "DESIGN_UPDATE") {
        const result = await designAgent.updateDesign({ text: args.text || "", scope: designScope, userId: args.userId });
        return { success: true, result: { ...result, scope: designScope, action: "DESIGN_UPDATE" } };
      }
      const result = await designAgent.generateDesign({ text: args.text || "", scope: designScope, userId: args.userId });
      return { success: true, result: { ...result, scope: designScope, action: "DESIGN" } };
    }

    // NL → Interpreter
    const interpreter = new InterpreterAgent(this.instancesDb(), this.env);
    const result = await interpreter.processIntent({ ...args, action: undefined });
    return { success: true, result };
  }
}
