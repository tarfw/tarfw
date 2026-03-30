import { getAuthToken } from '../auth/googleSignIn';

export const API_BASE_URL = "https://taragent.tar-54d.workers.dev";

// Helper to get auth headers with token
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  console.log('[getAuthHeaders] token present:', !!token);
  return headers;
}
export const CHANNEL_URL = `${API_BASE_URL}/api/channel`;
export const STATE_URL = `${API_BASE_URL}/api/state`;
export const STATES_LIST_URL = `${API_BASE_URL}/api/states`;
export const STATEAI_URL = `${API_BASE_URL}/api/stateai`;
export const SEARCH_URL = `${API_BASE_URL}/api/search`;
export const INSTANCE_URL = `${API_BASE_URL}/api/instance`;
export const CLOUD_EVENTS_URL = `${API_BASE_URL}/api/events`;
export const WS_URL = 'wss://taragent.tar-54d.workers.dev/api/ws';

// ─── Channel API (natural language + search only) ───

// ─── Auth Scopes API (store management) ───

export async function listScopesApi(): Promise<{ scopes: { scope: string; role: string }[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/auth/scopes`, { headers });
  if (!response.ok) throw new Error(`Scopes LIST Error: ${response.status}`);
  return response.json();
}

export async function createScopeApi(scope: string): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/auth/scopes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ scope }),
  });
  if (!response.ok) throw new Error(`Scope CREATE Error: ${response.status}`);
  return response.json();
}

export async function sendChannelMessage(req: {
  channel: string;
  userId: string;
  scope: string;
  text?: string;
  action?: "SEARCH" | "DESIGN" | "DESIGN_UPDATE";
}) {
  const headers = await getAuthHeaders();
  console.log('[sendChannelMessage] URL:', CHANNEL_URL);
  console.log('[sendChannelMessage] Headers:', JSON.stringify(headers));
  console.log('[sendChannelMessage] Body:', JSON.stringify(req));
  const response = await fetch(CHANNEL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  console.log('[sendChannelMessage] Response status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[sendChannelMessage] Error body:', errorText);
    throw new Error(`Channel API Error: ${response.status} — ${errorText}`);
  }
  const json = await response.json();
  console.log('[sendChannelMessage] Response JSON:', JSON.stringify(json));
  return json;
}

// ─── State API (direct CRUD — no workspace live stream, no instance, no broadcast) ───

export async function createStateApi(ucode: string, title: string | undefined, payload: any, scope = "shop:main") {
  const headers = await getAuthHeaders();
  const response = await fetch(STATE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ ucode, title, payload, scope }),
  });
  if (!response.ok) throw new Error(`State CREATE Error: ${response.status}`);
  return response.json();
}

// LIST all states - for instance creation flow
export async function listStatesApi(scope = "shop:main", type?: string, limit = 50) {
  const params = new URLSearchParams({ scope });
  if (type) params.set('type', type);
  params.set('limit', limit.toString());    const headers = await getAuthHeaders();
    const response = await fetch(`${STATES_LIST_URL}?${params.toString()}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) throw new Error(`States LIST Error: ${response.status}`);
  return response.json();
}

export async function updateStateApi(ucode: string, title: string | undefined, payload: any, scope = "shop:main") {
  const headers = await getAuthHeaders();
  const response = await fetch(`${STATE_URL}/${encodeURIComponent(ucode)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ title, payload, scope }),
  });
  if (!response.ok) throw new Error(`State UPDATE Error: ${response.status}`);
  return response.json();
}

export async function deleteStateApi(ucode: string, scope = "shop:main") {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${STATE_URL}/${encodeURIComponent(ucode)}?scope=${encodeURIComponent(scope)}`,
    { method: "DELETE", headers }
  );
  if (!response.ok) throw new Error(`State DELETE Error: ${response.status}`);
  return response.json();
}

export async function readStateApi(ucode: string, scope = "shop:main") {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${STATE_URL}/${encodeURIComponent(ucode)}?scope=${encodeURIComponent(scope)}`
  );
  if (!response.ok) throw new Error(`State READ Error: ${response.status}`);
  return response.json();
}

// ─── Embedding API (mobile sends local embeddings to remote) ───

export async function upsertEmbeddingApi(stateId: string, vector: number[]) {
  const headers = await getAuthHeaders();
  const response = await fetch(STATEAI_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ stateId, vector }),
  });
  if (!response.ok) throw new Error(`Embedding UPSERT Error: ${response.status}`);
  return response.json();
}

// ─── Server-side Search API (optional - mobile can also search locally) ───

export async function searchServerApi(vector: number[], scope = "shop:main", limit = 10) {
  const headers = await getAuthHeaders();
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ vector, scope, limit }),
  });
  if (!response.ok) throw new Error(`Search Error: ${response.status}`);
  return response.json();
}

// ─── Instance API (working state under products/services) ───

export interface InstanceData {
  id?: string; // Optional: pass local ID to ensure consistency
  stateid: string;
  type?: string;
  scope?: string;
  qty?: number;
  value?: number;
  currency?: string;
  available?: boolean;
  lat?: number;
  lng?: number;
  h3?: string;
  startts?: string;
  endts?: string;
  payload?: Record<string, any>;
}

export async function createInstanceApi(data: InstanceData) {
  const headers = await getAuthHeaders();
  const response = await fetch(INSTANCE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Instance CREATE Error: ${response.status}`);
  return response.json();
}

export async function getInstancesByStateApi(stateid: string, scope = "shop:main") {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${INSTANCE_URL}/${encodeURIComponent(stateid)}?scope=${encodeURIComponent(scope)}`,
    { headers }
  );
  if (!response.ok) throw new Error(`Instance READ Error: ${response.status}`);
  return response.json();
}

export async function updateInstanceApi(id: string, data: Partial<InstanceData>) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${INSTANCE_URL}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Instance UPDATE Error: ${response.status}`);
  return response.json();
}

export async function deleteInstanceApi(id: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${INSTANCE_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) throw new Error(`Instance DELETE Error: ${response.status}`);
  return response.json();
}

// ─── Cloud Events API (fetch persisted events from DO SQLite) ───

export async function getCloudEventsApi(scope = "shop:main", limit = 50) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${CLOUD_EVENTS_URL}/${scope}?limit=${limit}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Cloud Events Error: ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Push a single event to DO via POST /api/event
export async function pushCloudEventApi(event: {
  opcode: number;
  streamid: string;
  delta: number;
  payload?: Record<string, any>;
  scope?: string;
}) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/event`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        opcode: event.opcode,
        streamid: event.streamid,
        delta: event.delta,
        payload: event.payload,
        scope: event.scope || 'shop:main',
      }),
    });
    if (!response.ok) throw new Error(`Push Event Error: ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}
