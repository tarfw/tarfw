import { routeAgentRequest } from "agents";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { getStatesDbClient, getInstancesDbClient } from "./db/client";
import { InterpreterAgent } from "./agents/interpreter";
import { SearchAgent } from "./agents/search";
import { DesignAgent } from "./agents/design";
import { authDb, verifyGoogleToken, upsertGoogleUser, createSession, validateSession, deleteSession, getUserScopes, getUserScopesWithRoles, addScopeToUser, authenticateRequest } from "./auth";

// Re-export Durable Objects for Wrangler binding
export { TarAgent } from "./agent";
export { EventHub } from "./do/eventhub";

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


// ─── TarAgent RPC helper ───
function getTarAgentStub(env: Env, scope: string = "default") {
  const id = env.TarAgent.idFromName(scope);
  return env.TarAgent.get(id);
}

// ─── EventHub helper (per-user) ───
function getEventHubStub(env: Env, userId: string) {
  const id = env.EVENT_HUB.idFromName(userId);
  return env.EVENT_HUB.get(id);
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

    // ─── Auth routes → Turso auth DB ───
    if (path === "/api/auth/google" && request.method === "POST") {
      const body = await request.json() as any;
      if (!body.google_token) return jsonResponse({ error: "google_token required" }, 400);
      const googleUser = await verifyGoogleToken(body.google_token, env.GOOGLE_CLIENT_ID);
      if (!googleUser) return jsonResponse({ error: "Invalid Google token" }, 401);
      const db = authDb(env);
      const user = await upsertGoogleUser(db, googleUser);
      const session = await createSession(db, user.id);
      const scopes = await getUserScopes(db, user.id);
      return jsonResponse({ success: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, token: session.token, expires_at: session.expires_at, scopes });
    }
    if (path === "/api/auth/me" && request.method === "GET") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      return jsonResponse({ success: true, user: auth.user, scopes: auth.scopes });
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
      await deleteSession(authDb(env), authHeader.slice(7));
      return jsonResponse({ success: true, message: "Logged out" });
    }
    if (path === "/api/auth/scopes" && request.method === "GET") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scopesWithRoles = await getUserScopesWithRoles(authDb(env), auth.user_id);
      return jsonResponse({ success: true, scopes: scopesWithRoles });
    }
    if (path === "/api/auth/scopes" && request.method === "POST") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const body = await request.json() as any;
      if (!body.scope) return jsonResponse({ error: "scope required" }, 400);
      await addScopeToUser(authDb(env), auth.user_id, body.scope, "owner");
      return jsonResponse({ success: true, scope: body.scope }, 201);
    }

    // ─── WebSocket proxy to EventHub (per-user) ───
    if (path.startsWith("/api/ws")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }
      const token = url.searchParams.get("token");
      if (!token) return jsonResponse({ error: "token required" }, 401);
      const db = authDb(env);
      const validation = await validateSession(db, token);
      if (!validation.valid || !validation.user_id) return jsonResponse({ error: "Invalid token" }, 401);
      const stub = getEventHubStub(env, validation.user_id);
      const newUrl = new URL(request.url);
      newUrl.searchParams.delete("token");
      return stub.fetch(new Request(newUrl.toString(), {
        headers: { ...Object.fromEntries(request.headers), Authorization: `Bearer ${token}` },
      }));
    }

    // ─── REST compat: State CRUD → TarAgent @callable() ───
    if (path === "/api/state" && request.method === "POST") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const body = await request.json() as any;
      const stub = getTarAgentStub(env, body.scope || "default");
      const result = await stub.callCreateState({ ...body, userid: auth.user_id });
      return jsonResponse(result, 201);
    }
    if (path.startsWith("/api/state/") && request.method === "PUT") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const ucode = path.split("/api/state/")[1];
      const body = await request.json() as any;
      const stub = getTarAgentStub(env, body.scope || "default");
      const result = await stub.callUpdateState({ ucode, ...body, userid: auth.user_id });
      return jsonResponse(result);
    }
    if (path.startsWith("/api/state/") && request.method === "DELETE") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const ucode = path.split("/api/state/")[1];
      const scope = url.searchParams.get("scope") || "shop:main";
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      await db.execute({ sql: "DELETE FROM state WHERE ucode = ? AND scope = ?", args: [ucode, scope] });
      return jsonResponse({ success: true, result: { ucode, deleted: true } });
    }
    if (path.startsWith("/api/state/") && request.method === "GET") {
      const ucode = path.split("/api/state/")[1];
      const scope = url.searchParams.get("scope") || "shop:main";
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      const result = await db.execute({
        sql: "SELECT id, ucode, type, title, payload, scope, userid, public, ts FROM state WHERE ucode = ? AND scope = ?",
        args: [ucode, scope],
      });
      if (result.rows.length === 0) return jsonResponse({ error: "Not found" }, 404);
      return jsonResponse({ success: true, result: result.rows[0] });
    }
    if (path === "/api/states/public" && request.method === "GET") {
      const type = url.searchParams.get("type");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const q = url.searchParams.get("q");
      const db = getStatesDbClient(env.STATES_DB_URL, env.STATES_DB_TOKEN);
      let sql = "SELECT id, ucode, type, title, payload, scope, userid, ts FROM state WHERE public = 1";
      const args: any[] = [];
      if (type) { sql += " AND type = ?"; args.push(type); }
      if (q) { sql += " AND title LIKE ?"; args.push(`%${q}%`); }
      sql += " ORDER BY ts DESC LIMIT ?";
      args.push(limit);
      const result = await db.execute({ sql, args });
      return jsonResponse({ success: true, result: result.rows });
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

        // Route to Product Parser (no events, no instances — just AI structured output)
        const isProductParse = body.action === "PARSE_PRODUCT" ||
          body.text?.toLowerCase().startsWith("create product:");

        if (isProductParse) {
          try {
            const groq = createGroq({ apiKey: env.GROQ_API_KEY });
            const { text: responseText } = await generateText({
              model: groq("llama-3.3-70b-versatile"),
              system: `You parse product descriptions into structured JSON for a commerce system.
Return ONLY valid JSON matching this schema:
{"title":"string","price":number,"currency":"string","brand":"string","sku":"string","sizes":["S","M"],"colors":["Red","Blue"]}
- title is required, all other fields are optional
- currency defaults to "INR" if not specified, use "USD" for $, "EUR" for €, "GBP" for £
- sizes and colors should be arrays of strings
- sku should be auto-generated if not provided (e.g. "NIKE-SHOES-001")
- Extract brand from the description if mentioned
Output ONLY the JSON object. No markdown, no explanation.`,
              prompt: body.text.replace(/^create product:\s*/i, ''),
            });

            console.log("[PARSE_PRODUCT] raw AI response:", responseText);
            const raw = (responseText || "").replace(/```json\n?|\n?```/g, "").trim();
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            const product = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);

            return jsonResponse({
              success: true,
              result: { action: "PARSE_PRODUCT", product }
            });
          } catch (parseErr: any) {
            console.error("[PARSE_PRODUCT] Error:", parseErr);
            return jsonResponse({
              error: "Failed to parse product",
              message: parseErr.message,
            }, 500);
          }
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

    // ─── REST compat: Events (per-user EventHub) ───
    if (path === "/api/event" && request.method === "POST") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const body = await request.json() as any;
      const scope = body.scope || auth.scopes[0] || "";
      const stub = getEventHubStub(env, auth.user_id);
      const event = { opcode: body.opcode, streamid: body.streamid, delta: body.delta || 0, payload: body.payload || {}, scope, timestamp: new Date().toISOString() };
      const response = await stub.fetch(new Request(`http://localhost/api/events?scope=${scope}`, { method: "POST", body: JSON.stringify(event) }));
      const result = await response.json();
      return jsonResponse({ success: true, result: { emitted: true, event, scope, ...(result as object) } }, 201);
    }
    if (path.startsWith("/api/events/") && request.method === "GET") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scope = path.split("/api/events/")[1];
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const stub = getEventHubStub(env, auth.user_id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?limit=${limit}&scope=${scope}`));
      if (!response.ok) return jsonResponse({ error: "DO error" }, 500);
      const events = await response.json();
      return jsonResponse({ success: true, result: events });
    }
    if (path.startsWith("/api/events/") && request.method === "DELETE") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scope = path.split("/api/events/")[1];
      const eventId = url.searchParams.get("id");
      if (!eventId) return jsonResponse({ error: "Event ID required" }, 400);
      const stub = getEventHubStub(env, auth.user_id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "DELETE" }));
      const result = await response.json();
      return jsonResponse({ success: true, result });
    }
    if (path.startsWith("/api/events/") && request.method === "PUT") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scope = path.split("/api/events/")[1];
      const eventId = url.searchParams.get("id");
      if (!eventId) return jsonResponse({ error: "Event ID required" }, 400);
      const body = await request.json();
      const stub = getEventHubStub(env, auth.user_id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?id=${eventId}&scope=${scope}`, { method: "PUT", body: JSON.stringify(body) }));
      const result = await response.json();
      return jsonResponse({ success: true, result });
    }

    // ─── REST compat: Design ───
    if (path.startsWith("/api/design/history/") && request.method === "GET") {
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scope = path.split("/api/design/history/")[1];
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const stub = getEventHubStub(env, auth.user_id);
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
      const auth = await authenticateRequest(env, request);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: corsHeaders() });
      const scope = path.split("/api/design/revert/")[1];
      const body = await request.json() as any;
      if (!body.eventId) return jsonResponse({ error: "eventId is required" }, 400);
      const stub = getEventHubStub(env, auth.user_id);
      const response = await stub.fetch(new Request(`http://localhost/api/events?limit=100&scope=${scope}`));
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
