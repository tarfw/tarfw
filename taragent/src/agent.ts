import { createGroq } from "@ai-sdk/groq";
import { callable, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  generateText,
  tool,
} from "ai";
import { z } from "zod";
import { getStatesDbClient, getInstancesDbClient } from "./db/client";
import { InterpreterAgent, OPCODE_NAMES } from "./agents/interpreter";
import { SearchAgent } from "./agents/search";
import { DesignAgent } from "./agents/design";
import { AnalyticsAgent } from "./agents/analytics";

export class TarAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;

  // ─── Helpers ───

  private groq() {
    return createGroq({ apiKey: this.env.GROQ_API_KEY });
  }

  private statesDb() {
    return getStatesDbClient(this.env.STATES_DB_URL, this.env.STATES_DB_TOKEN);
  }

  private instancesDb() {
    return getInstancesDbClient(this.env.INSTANCES_DB_URL, this.env.INSTANCES_DB_TOKEN);
  }

  // ─── Chat ───

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const groq = this.groq();

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
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
      tools: {
        // ─── State CRUD ───
        createState: tool({
          description: "Create a new state record (product, service, etc.)",
          inputSchema: z.object({
            ucode: z.string().describe("Unique code like 'product:coffee'"),
            title: z.string().optional(),
            payload: z.record(z.any()).optional(),
            scope: z.string().default("shop:main"),
          }),
          execute: async ({ ucode, title, payload, scope }) => {
            const db = this.statesDb();
            const [type] = ucode.split(":");
            const id = crypto.randomUUID();
            await db.execute({
              sql: "INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, ?, ?, ?, ?)",
              args: [id, ucode, type || "unknown", title || null, JSON.stringify(payload || {}), scope],
            });
            return { success: true, id, ucode, title, scope };
          },
        }),

        updateState: tool({
          description: "Update an existing state record",
          inputSchema: z.object({
            ucode: z.string(),
            title: z.string().optional(),
            payload: z.record(z.any()).optional(),
            scope: z.string().default("shop:main"),
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
          inputSchema: z.object({
            ucode: z.string(),
            scope: z.string().default("shop:main"),
          }),
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
          inputSchema: z.object({
            ucode: z.string(),
            scope: z.string().default("shop:main"),
          }),
          execute: async ({ ucode, scope }) => {
            const db = this.statesDb();
            const result = await db.execute({
              sql: "SELECT id, ucode, type, title, payload, scope, created_at FROM state WHERE ucode = ? AND scope = ?",
              args: [ucode, scope],
            });
            return result.rows.length > 0 ? result.rows[0] : { error: "Not found" };
          },
        }),

        listStates: tool({
          description: "List state records, optionally filtered by type",
          inputSchema: z.object({
            scope: z.string().default("shop:main"),
            type: z.string().optional(),
            limit: z.number().default(50),
          }),
          execute: async ({ scope, type, limit }) => {
            const db = this.statesDb();
            let sql = "SELECT id, ucode, type, title, payload, scope FROM state WHERE scope = ?";
            const args: any[] = [scope];
            if (type) { sql += " AND type = ?"; args.push(type); }
            sql += " ORDER BY ts DESC LIMIT ?";
            args.push(limit);
            const result = await db.execute({ sql, args });
            return result.rows;
          },
        }),

        // ─── Instance CRUD ───
        createInstance: tool({
          description: "Create a new instance (inventory item, working state)",
          inputSchema: z.object({
            stateid: z.string(),
            type: z.string().default("inventory"),
            scope: z.string().default("shop:main"),
            qty: z.number().optional(),
            value: z.number().optional(),
            currency: z.string().default("INR"),
            available: z.boolean().default(true),
            payload: z.record(z.any()).optional(),
          }),
          execute: async ({ stateid, type, scope, qty, value, currency, available, payload }) => {
            const db = this.instancesDb();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            await db.execute({
              sql: `CREATE TABLE IF NOT EXISTS instance (
                id TEXT PRIMARY KEY, stateid TEXT NOT NULL, type TEXT, scope TEXT,
                qty REAL, value REAL, currency TEXT, available INTEGER DEFAULT 1,
                lat REAL, lng REAL, h3 TEXT, startts TEXT, endts TEXT, ts TEXT, payload TEXT
              )`,
              args: [],
            });
            await db.execute({
              sql: `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, ts, payload)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [id, stateid, type, scope, qty ?? null, value ?? null, currency, available ? 1 : 0, now, payload ? JSON.stringify(payload) : null],
            });
            return { success: true, id, stateid, scope };
          },
        }),

        getInstances: tool({
          description: "Get instances by stateid",
          inputSchema: z.object({
            stateid: z.string(),
            scope: z.string().default("shop:main"),
          }),
          execute: async ({ stateid, scope }) => {
            const db = this.instancesDb();
            const result = await db.execute({
              sql: "SELECT * FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC",
              args: [stateid, scope],
            });
            return result.rows;
          },
        }),

        updateInstance: tool({
          description: "Update an instance by ID",
          inputSchema: z.object({
            id: z.string(),
            qty: z.number().optional(),
            value: z.number().optional(),
            available: z.boolean().optional(),
            payload: z.record(z.any()).optional(),
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

        // ─── Embeddings ───
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
            scope: z.string().default("shop:main"),
            limit: z.number().default(10),
          }),
          execute: async ({ vector, scope, limit }) => {
            const db = this.statesDb();
            const result = await db.execute({
              sql: `SELECT s.id, s.ucode, s.type, s.title, s.payload, s.scope,
                    vector_distance_cos(e.embedding, vector32(?)) as distance
                    FROM state s JOIN stateai e ON s.id = e.state_id
                    WHERE s.scope = ? ORDER BY distance ASC LIMIT ?`,
              args: [JSON.stringify(vector), scope, limit],
            });
            return result.rows;
          },
        }),

        // ─── Events ───
        emitEvent: tool({
          description: "Emit a cloud event to OrderDO for persistence and broadcast",
          inputSchema: z.object({
            opcode: z.number().min(101).max(999),
            streamid: z.string(),
            delta: z.number().default(0),
            payload: z.record(z.any()).optional(),
            scope: z.string().default("shop:main"),
          }),
          execute: async ({ opcode, streamid, delta, payload, scope }) => {
            const id = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(id);
            const event = { opcode, streamid, delta, payload: payload || {}, scope, timestamp: new Date().toISOString() };
            const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, {
              method: "POST",
              body: JSON.stringify(event),
            }));
            const result = await response.json();
            return { success: true, event, result };
          },
        }),

        getEvents: tool({
          description: "Get recent events for a scope",
          inputSchema: z.object({
            scope: z.string().default("shop:main"),
            limit: z.number().default(50),
          }),
          execute: async ({ scope, limit }) => {
            const id = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(id);
            const response = await stub.fetch(new Request(`http://localhost/api/events?limit=${limit}&scope=${scope}`));
            return await response.json();
          },
        }),

        deleteEvent: tool({
          description: "Delete an event by ID",
          inputSchema: z.object({
            eventId: z.string(),
            scope: z.string().default("shop:main"),
          }),
          execute: async ({ eventId, scope }) => {
            const id = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(id);
            const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "DELETE" }));
            return await response.json();
          },
        }),

        updateEvent: tool({
          description: "Update an event by ID",
          inputSchema: z.object({
            eventId: z.string(),
            scope: z.string().default("shop:main"),
            opcode: z.number().optional(),
            streamid: z.string().optional(),
            delta: z.number().optional(),
            payload: z.record(z.any()).optional(),
          }),
          execute: async ({ eventId, scope, ...body }) => {
            const id = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(id);
            const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, {
              method: "PUT",
              body: JSON.stringify(body),
            }));
            return await response.json();
          },
        }),

        // ─── Design ───
        generateDesign: tool({
          description: "Generate a storefront design for a scope",
          inputSchema: z.object({
            text: z.string().describe("Description of the store to design"),
            scope: z.string().default("shop:main"),
            userId: z.string().default("agent"),
          }),
          execute: async ({ text, scope, userId }) => {
            const statesDb = this.statesDb();
            const designAgent = new DesignAgent(statesDb, this.env);

            // Auto-extract slug for new stores
            if (scope === "shop:main" && text) {
              const slug = this.extractSlug(text);
              scope = `shop:${slug}`;
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
            const statesDb = this.statesDb();
            const designAgent = new DesignAgent(statesDb, this.env);
            return await designAgent.updateDesign({ text, scope, userId });
          },
        }),

        getDesignHistory: tool({
          description: "Get design snapshot history for a scope",
          inputSchema: z.object({
            scope: z.string(),
            limit: z.number().default(10),
          }),
          execute: async ({ scope, limit }) => {
            const id = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(id);
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
          inputSchema: z.object({
            eventId: z.string(),
            scope: z.string(),
          }),
          execute: async ({ eventId, scope }) => {
            const doId = this.env.ORDER_DO.idFromName(scope);
            const stub = this.env.ORDER_DO.get(doId);
            const response = await stub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
            if (!response.ok) return { error: "Failed to fetch events" };
            const allEvents: any[] = await response.json();
            const snapshot = allEvents.find((e: any) => e.id === eventId && e.opcode === 813 && e.payload?.storeConfig);
            if (!snapshot) return { error: "Snapshot not found" };
            const statesDb = this.statesDb();
            const designAgent = new DesignAgent(statesDb, this.env);
            return await designAgent.revertDesign({ snapshotPayload: snapshot.payload, scope });
          },
        }),

        // ─── NL Intent ───
        interpretIntent: tool({
          description: "Interpret natural language into a TAR opcode operation",
          inputSchema: z.object({
            text: z.string(),
            scope: z.string().default("shop:main"),
            userId: z.string().default("agent"),
          }),
          execute: async ({ text, scope, userId }) => {
            const instancesDb = this.instancesDb();
            const interpreter = new InterpreterAgent(instancesDb, this.env);
            return await interpreter.processIntent({ text, scope, userId, channel: "agent" });
          },
        }),

        // ─── Analytics ───
        generateReport: tool({
          description: "Generate a daily analytics report for a scope",
          inputSchema: z.object({ scope: z.string().default("shop:main") }),
          execute: async ({ scope }) => {
            const db = this.instancesDb();
            const analytics = new AnalyticsAgent(db);
            return await analytics.generateDailyReport(scope);
          },
        }),

        // ─── Scheduling ───
        scheduleTask: tool({
          description: "Schedule a task to be executed later",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") return "Not a valid schedule input";
            const input = when.type === "scheduled" ? when.date
              : when.type === "delayed" ? when.delayInSeconds
              : when.type === "cron" ? when.cron : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description, { idempotent: true });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
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
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          },
        }),
      },
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
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
  async callCreateState(args: { ucode: string; title?: string; payload?: Record<string, any>; scope?: string }) {
    const db = this.statesDb();
    const [type] = args.ucode.split(":");
    const id = crypto.randomUUID();
    const scope = args.scope || "shop:main";
    await db.execute({
      sql: "INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, args.ucode, type || "unknown", args.title || null, JSON.stringify(args.payload || {}), scope],
    });
    return { success: true, result: { id, ucode: args.ucode, title: args.title, scope } };
  }

  @callable()
  async callUpdateState(args: { ucode: string; title?: string; payload?: Record<string, any>; scope?: string }) {
    const db = this.statesDb();
    const scope = args.scope || "shop:main";
    await db.execute({
      sql: "UPDATE state SET title = COALESCE(?, title), payload = COALESCE(?, payload) WHERE ucode = ? AND scope = ?",
      args: [args.title || null, args.payload ? JSON.stringify(args.payload) : null, args.ucode, scope],
    });
    return { success: true, result: { ucode: args.ucode, updated: true } };
  }

  @callable()
  async callGetStates(args: { scope?: string; type?: string; limit?: number }) {
    const db = this.statesDb();
    const scope = args.scope || "shop:main";
    let sql = "SELECT id, ucode, type, title, payload, scope FROM state WHERE scope = ?";
    const sqlArgs: any[] = [scope];
    if (args.type) { sql += " AND type = ?"; sqlArgs.push(args.type); }
    sql += " ORDER BY ts DESC LIMIT ?";
    sqlArgs.push(args.limit || 50);
    const result = await db.execute({ sql, args: sqlArgs });
    return { success: true, result: result.rows };
  }

  @callable()
  async callCreateInstance(args: {
    stateid: string; type?: string; scope?: string; qty?: number; value?: number;
    currency?: string; available?: boolean; payload?: Record<string, any>;
  }) {
    const db = this.instancesDb();
    const id = crypto.randomUUID();
    const scope = args.scope || "shop:main";
    const now = new Date().toISOString();
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS instance (
        id TEXT PRIMARY KEY, stateid TEXT NOT NULL, type TEXT, scope TEXT,
        qty REAL, value REAL, currency TEXT, available INTEGER DEFAULT 1,
        lat REAL, lng REAL, h3 TEXT, startts TEXT, endts TEXT, ts TEXT, payload TEXT
      )`,
      args: [],
    });
    await db.execute({
      sql: `INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, ts, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, args.stateid, args.type || "inventory", scope, args.qty ?? null, args.value ?? null, args.currency || "INR", args.available !== false ? 1 : 0, now, args.payload ? JSON.stringify(args.payload) : null],
    });
    return { success: true, result: { id, stateid: args.stateid, scope } };
  }

  @callable()
  async callGetInstances(args: { stateid: string; scope?: string }) {
    const db = this.instancesDb();
    const scope = args.scope || "shop:main";
    const result = await db.execute({
      sql: "SELECT * FROM instance WHERE stateid = ? AND scope = ? ORDER BY ts DESC",
      args: [args.stateid, scope],
    });
    return { success: true, result: result.rows };
  }

  @callable()
  async callEmitEvent(args: { opcode: number; streamid: string; delta?: number; payload?: Record<string, any>; scope?: string }) {
    const scope = args.scope || "shop:main";
    const id = this.env.ORDER_DO.idFromName(scope);
    const stub = this.env.ORDER_DO.get(id);
    const event = { opcode: args.opcode, streamid: args.streamid, delta: args.delta || 0, payload: args.payload || {}, scope, timestamp: new Date().toISOString() };
    const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, { method: "POST", body: JSON.stringify(event) }));
    const result = await response.json();
    return { success: true, result: { emitted: true, event, ...result } };
  }

  @callable()
  async callChannel(args: {
    channel: string; userId: string; scope: string; text?: string;
    action?: "SEARCH" | "DESIGN" | "DESIGN_UPDATE"; data?: Record<string, any>;
  }) {
    // Route to Search
    if ((args.action === "SEARCH" || args.text?.toLowerCase().startsWith("search")) && args.text) {
      const statesDb = this.statesDb();
      const searchAgent = new SearchAgent(statesDb, this.env);
      const result = await searchAgent.processSearch(args.text, args.scope || "shop:main");
      return { success: true, result: { ...result, action: "SEARCH" } };
    }

    // Route to Design
    const isDesign = args.action === "DESIGN" || args.action === "DESIGN_UPDATE" ||
      (args.text && /^(design|create|build|setup)\s+(my\s+)?(store|shop|site|storefront)/i.test(args.text));

    if (isDesign) {
      const statesDb = this.statesDb();
      const designAgent = new DesignAgent(statesDb, this.env);
      let scope = args.scope || "shop:main";
      let action = args.action || "DESIGN";

      if (action !== "DESIGN_UPDATE" && scope === "shop:main" && args.text) {
        scope = `shop:${this.extractSlug(args.text)}`;
      }

      if (action === "DESIGN_UPDATE") {
        const result = await designAgent.updateDesign({ text: args.text || "", scope, userId: args.userId });
        return { success: true, result: { ...result, scope, action: "DESIGN_UPDATE" } };
      }
      const result = await designAgent.generateDesign({ text: args.text || "", scope, userId: args.userId });
      return { success: true, result: { ...result, scope, action: "DESIGN" } };
    }

    // NL → Interpreter
    const instancesDb = this.instancesDb();
    const interpreter = new InterpreterAgent(instancesDb, this.env);
    const result = await interpreter.processIntent({ ...args, action: undefined });
    return { success: true, result };
  }

  // ─── Utility ───

  private extractSlug(text: string): string {
    const namedMatch = text.match(/(?:called|named|name\s*:|name)\s+([a-zA-Z0-9-]+)/i);
    if (namedMatch) return namedMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const brandMatch = text.match(/(?:brand|by)\s+([a-zA-Z0-9-]+)/i);
    if (brandMatch) return brandMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const typeMatch = text.match(/([a-zA-Z0-9-]+)\s+(?:store|shop|bakery|cafe|restaurant|site)/i);
    if (typeMatch) return typeMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const storeMatch = text.match(/(?:store|shop|bakery|cafe|restaurant|brand|site)\s+([a-zA-Z0-9-]+)/i);
    if (storeMatch) return storeMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter(w => w.length > 2 && !["create", "design", "build", "make", "setup", "my", "the", "for", "store", "shop"].includes(w));
    return words[0] || "mystore";
  }
}
