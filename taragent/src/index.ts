import { routeAgentRequest } from "agents";
import { getStatesDbClient, getInstancesDbClient } from "./db/client";
import { InterpreterAgent } from "./agents/interpreter";
import { SearchAgent } from "./agents/search";
import { DesignAgent } from "./agents/design";

// Re-export Durable Objects for Wrangler binding
export { TarAgent } from "./agent";
export { OrderDO } from "./do/order";
export { SessionDO } from "./do/session";

// ─── CORS helper ───
function corsHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
    ...headers,
  };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

// ─── Auth helper ───
async function getSessionStub(env: Env) {
  return env.SESSION_DO.get(env.SESSION_DO.idFromName("auth"));
}

async function proxyToSession(request: Request, env: Env, path: string, method: string, body?: any): Promise<Response> {
  const stub = await getSessionStub(env);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const response = await stub.fetch(new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }));

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: corsHeaders(),
  });
}

// ─── TarAgent RPC helper ───
function getTarAgentStub(env: Env, scope: string = "default") {
  const id = env.TarAgent.idFromName(scope);
  return env.TarAgent.get(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ─── Health check ───
    if (path === "/api/health") {
      return jsonResponse({ status: "ok", agent: "taragent" });
    }

    // ─── Auth routes → SessionDO ───
    if (path === "/api/auth/google" && request.method === "POST") {
      const body = await request.json();
      return proxyToSession(request, env, "/auth/google", "POST", body);
    }
    if (path === "/api/auth/me" && request.method === "GET") {
      return proxyToSession(request, env, "/auth/me", "GET");
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      return proxyToSession(request, env, "/auth/logout", "POST");
    }
    if (path === "/api/auth/scopes" && request.method === "GET") {
      return proxyToSession(request, env, "/auth/scopes", "GET");
    }
    if (path === "/api/auth/scopes" && request.method === "POST") {
      const body = await request.json();
      return proxyToSession(request, env, "/auth/scopes", "POST", body);
    }

    // ─── WebSocket proxy to OrderDO ───
    if (path.startsWith("/api/ws/")) {
      const scope = path.split("/api/ws/")[1];
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }
      const token = url.searchParams.get("token");
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      if (token) {
        const newUrl = new URL(request.url);
        newUrl.searchParams.delete("token");
        return stub.fetch(new Request(newUrl.toString(), {
          headers: { ...Object.fromEntries(request.headers), Authorization: `Bearer ${token}` },
        }));
      }
      return stub.fetch(request);
    }

    // ─── REST compat: State CRUD → TarAgent @callable() ───
    if (path === "/api/state" && request.method === "POST") {
      const body = await request.json() as any;
      const stub = getTarAgentStub(env, body.scope || "default");
      const result = await stub.callCreateState(body);
      return jsonResponse(result, 201);
    }
    if (path.startsWith("/api/state/") && request.method === "PUT") {
      const ucode = path.split("/api/state/")[1];
      const body = await request.json() as any;
      const stub = getTarAgentStub(env, body.scope || "default");
      const result = await stub.callUpdateState({ ucode, ...body });
      return jsonResponse(result);
    }
    if (path.startsWith("/api/state/") && request.method === "DELETE") {
      const ucode = path.split("/api/state/")[1];
      const scope = url.searchParams.get("scope") || "shop:main";
      const stub = getTarAgentStub(env, scope);
      // Direct DB call for delete (simple enough)
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      await db.execute({ sql: "DELETE FROM state WHERE ucode = ? AND scope = ?", args: [ucode, scope] });
      return jsonResponse({ success: true, result: { ucode, deleted: true } });
    }
    if (path.startsWith("/api/state/") && request.method === "GET") {
      const ucode = path.split("/api/state/")[1];
      const scope = url.searchParams.get("scope") || "shop:main";
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      const result = await db.execute({
        sql: "SELECT id, ucode, type, title, payload, scope, created_at FROM state WHERE ucode = ? AND scope = ?",
        args: [ucode, scope],
      });
      if (result.rows.length === 0) return jsonResponse({ error: "Not found" }, 404);
      return jsonResponse({ success: true, result: result.rows[0] });
    }
    if (path === "/api/states" && request.method === "GET") {
      const scope = url.searchParams.get("scope") || "shop:main";
      const type = url.searchParams.get("type");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const stub = getTarAgentStub(env, scope);
      const result = await stub.callGetStates({ scope, type: type || undefined, limit });
      return jsonResponse(result);
    }

    // ─── REST compat: Instance CRUD ───
    if (path === "/api/instance" && request.method === "POST") {
      const body = await request.json() as any;
      const stub = getTarAgentStub(env, body.scope || "default");
      const result = await stub.callCreateInstance(body);
      return jsonResponse(result, 201);
    }
    if (path.startsWith("/api/instance/") && request.method === "GET") {
      const stateid = path.split("/api/instance/")[1];
      const scope = url.searchParams.get("scope") || "shop:main";
      const stub = getTarAgentStub(env, scope);
      const result = await stub.callGetInstances({ stateid, scope });
      return jsonResponse(result);
    }
    if (path.startsWith("/api/instance/") && request.method === "PUT") {
      const id = path.split("/api/instance/")[1];
      const body = await request.json() as any;
      const db = getInstancesDbClient(env.INSTANCES_DB_URL, env.INSTANCES_DB_TOKEN);
      const fields: string[] = [];
      const values: any[] = [];
      if (body.qty !== undefined) { fields.push("qty = ?"); values.push(body.qty); }
      if (body.value !== undefined) { fields.push("value = ?"); values.push(body.value); }
      if (body.currency !== undefined) { fields.push("currency = ?"); values.push(body.currency); }
      if (body.available !== undefined) { fields.push("available = ?"); values.push(body.available ? 1 : 0); }
      if (body.payload !== undefined) { fields.push("payload = ?"); values.push(JSON.stringify(body.payload)); }
      if (fields.length === 0) return jsonResponse({ error: "No fields to update" }, 400);
      values.push(id);
      await db.execute({ sql: `UPDATE instance SET ${fields.join(", ")} WHERE id = ?`, args: values });
      return jsonResponse({ success: true, result: { id, updated: true } });
    }
    if (path.startsWith("/api/instance/") && request.method === "DELETE") {
      const id = path.split("/api/instance/")[1];
      const db = getInstancesDbClient(env.INSTANCES_DB_URL, env.INSTANCES_DB_TOKEN);
      await db.execute({ sql: "DELETE FROM instance WHERE id = ?", args: [id] });
      return jsonResponse({ success: true, result: { id, deleted: true } });
    }

    // ─── REST compat: Embeddings ───
    if (path === "/api/stateai" && request.method === "POST") {
      const body = await request.json() as any;
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      await db.execute({
        sql: "INSERT OR REPLACE INTO stateai (state_id, embedding) VALUES (?, vector32(?))",
        args: [body.stateId, JSON.stringify(body.vector)],
      });
      return jsonResponse({ success: true, result: { stateId: body.stateId, stored: true } }, 201);
    }

    // ─── REST compat: Search ───
    if (path === "/api/search" && request.method === "POST") {
      const body = await request.json() as any;
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      const result = await db.execute({
        sql: `SELECT s.id, s.ucode, s.type, s.title, s.payload, s.scope,
              vector_distance_cos(e.embedding, vector32(?)) as distance
              FROM state s JOIN stateai e ON s.id = e.state_id
              WHERE s.scope = ? ORDER BY distance ASC LIMIT ?`,
        args: [JSON.stringify(body.vector), body.scope || "shop:main", body.limit || 10],
      });
      return jsonResponse({ result: result.rows });
    }

    // ─── REST compat: Channel (runs directly, not via DO RPC, for Groq compatibility) ───
    if (path === "/api/channel" && request.method === "POST") {
      try {
        const body = await request.json() as any;

        // Route to Search
        if ((body.action === "SEARCH" || body.text?.toLowerCase().startsWith("search")) && body.text) {
          const statesDb = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
          const searchAgent = new SearchAgent(statesDb, env);
          const result = await searchAgent.processSearch(body.text, body.scope || "shop:main");
          return jsonResponse({ success: true, result: { ...result, action: "SEARCH" } });
        }

        // Route to Design
        const isDesign = body.action === "DESIGN" || body.action === "DESIGN_UPDATE" ||
          (body.text && /^(design|create|build|setup)\s+(my\s+)?(store|shop|site|storefront)/i.test(body.text));

        if (isDesign) {
          const statesDb = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
          const designAgent = new DesignAgent(statesDb, env);
          let scope = body.scope || "shop:main";
          let action = body.action || "DESIGN";

          if (action !== "DESIGN_UPDATE" && scope === "shop:main" && body.text) {
            const slugMatch = body.text.match(/(?:called|named|name\s*:|name)\s+([a-zA-Z0-9-]+)/i);
            if (slugMatch) scope = `shop:${slugMatch[1].toLowerCase()}`;
          }

          if (action === "DESIGN_UPDATE") {
            const result = await designAgent.updateDesign({ text: body.text || "", scope, userId: body.userId });
            return jsonResponse({ success: true, result: { ...result, scope, action: "DESIGN_UPDATE" } });
          }
          const result = await designAgent.generateDesign({ text: body.text || "", scope, userId: body.userId });
          return jsonResponse({ success: true, result: { ...result, scope, action: "DESIGN" } });
        }

        // NL → Interpreter (direct, with Groq access via env)
        const instancesDb = getInstancesDbClient(env.INSTANCES_DB_URL, env.INSTANCES_DB_TOKEN);
        const interpreter = new InterpreterAgent(instancesDb, env);
        const result = await interpreter.processIntent({ ...body, action: undefined });
        return jsonResponse({ success: true, result });
      } catch (err: any) {
        console.error("Channel Error:", err);
        return jsonResponse({ error: "Internal Server Error", message: err.message }, 500);
      }
    }

    // ─── REST compat: Events ───
    if (path === "/api/event" && request.method === "POST") {
      const body = await request.json() as any;
      const scope = body.scope || "shop:main";
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      const event = { opcode: body.opcode, streamid: body.streamid, delta: body.delta || 0, payload: body.payload || {}, scope, timestamp: new Date().toISOString() };
      const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, { method: "POST", body: JSON.stringify(event) }));
      const result = await response.json();
      return jsonResponse({ success: true, result: { emitted: true, event, scope, ...(result as object) } }, 201);
    }
    if (path.startsWith("/api/events/") && request.method === "GET") {
      const scope = path.split("/api/events/")[1];
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?limit=${limit}&scope=${scope}`));
      if (!response.ok) return jsonResponse({ error: "DO error" }, 500);
      const events = await response.json();
      return jsonResponse({ success: true, result: events });
    }
    if (path.startsWith("/api/events/") && request.method === "DELETE") {
      const scope = path.split("/api/events/")[1];
      const eventId = url.searchParams.get("id");
      if (!eventId) return jsonResponse({ error: "Event ID required" }, 400);
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "DELETE" }));
      const result = await response.json();
      return jsonResponse({ success: true, result });
    }
    if (path.startsWith("/api/events/") && request.method === "PUT") {
      const scope = path.split("/api/events/")[1];
      const eventId = url.searchParams.get("id");
      if (!eventId) return jsonResponse({ error: "Event ID required" }, 400);
      const body = await request.json();
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "PUT", body: JSON.stringify(body) }));
      const result = await response.json();
      return jsonResponse({ success: true, result });
    }

    // ─── REST compat: Design ───
    if (path.startsWith("/api/design/history/") && request.method === "GET") {
      const scope = path.split("/api/design/history/")[1];
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const id = env.ORDER_DO.idFromName(scope);
      const stub = env.ORDER_DO.get(id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
      if (!response.ok) return jsonResponse({ error: "Failed to fetch events" }, 500);
      const allEvents: any[] = await response.json();
      const snapshots = allEvents
        .filter((e: any) => e.opcode === 813 && e.payload?.storeConfig)
        .slice(0, limit)
        .map((e: any) => ({ id: e.id, ts: e.ts, scope: e.scope }));
      return jsonResponse({ success: true, result: snapshots });
    }
    if (path.startsWith("/api/design/revert/") && request.method === "POST") {
      const scope = path.split("/api/design/revert/")[1];
      const body = await request.json() as any;
      if (!body.eventId) return jsonResponse({ error: "eventId is required" }, 400);
      const doId = env.ORDER_DO.idFromName(scope);
      const doStub = env.ORDER_DO.get(doId);
      const response = await doStub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
      if (!response.ok) return jsonResponse({ error: "Failed to fetch events" }, 500);
      const allEvents: any[] = await response.json();
      const snapshot = allEvents.find((e: any) => e.id === body.eventId && e.opcode === 813 && e.payload?.storeConfig);
      if (!snapshot) return jsonResponse({ error: "Snapshot not found" }, 404);
      const statesDb = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      const designAgent = new DesignAgent(statesDb, env);
      const result = await designAgent.revertDesign({ snapshotPayload: snapshot.payload, scope });
      return jsonResponse({ success: true, result });
    }

    // ─── Fallback: routeAgentRequest for WebSocket chat ───
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
