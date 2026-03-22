export const API_BASE_URL = "https://taragent.wetarteam.workers.dev";
export const CHANNEL_URL = `${API_BASE_URL}/api/channel`;
export const STATE_URL = `${API_BASE_URL}/api/state`;
export const STATES_LIST_URL = `${API_BASE_URL}/api/states`;
export const STATEAI_URL = `${API_BASE_URL}/api/stateai`;
export const SEARCH_URL = `${API_BASE_URL}/api/search`;
export const INSTANCE_URL = `${API_BASE_URL}/api/instance`;

// ─── Channel API (natural language + search only) ───

export async function sendChannelMessage(req: {
  channel: string;
  userId: string;
  scope: string;
  text?: string;
  action?: "SEARCH";
}) {
  const response = await fetch(CHANNEL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!response.ok) throw new Error(`Channel API Error: ${response.status}`);
  return response.json();
}

// ─── State API (direct CRUD — no workspace live stream, no instance, no broadcast) ───

export async function createStateApi(ucode: string, title: string | undefined, payload: any, scope = "shop:main") {
  const response = await fetch(STATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ucode, title, payload, scope }),
  });
  if (!response.ok) throw new Error(`State CREATE Error: ${response.status}`);
  return response.json();
}

// LIST all states - for instance creation flow
export async function listStatesApi(scope = "shop:main", type?: string, limit = 50) {
  const params = new URLSearchParams({ scope });
  if (type) params.set('type', type);
  params.set('limit', limit.toString());
  
  const response = await fetch(`${STATES_LIST_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`States LIST Error: ${response.status}`);
  return response.json();
}

export async function updateStateApi(ucode: string, title: string | undefined, payload: any, scope = "shop:main") {
  const response = await fetch(`${STATE_URL}/${encodeURIComponent(ucode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, payload, scope }),
  });
  if (!response.ok) throw new Error(`State UPDATE Error: ${response.status}`);
  return response.json();
}

export async function deleteStateApi(ucode: string, scope = "shop:main") {
  const response = await fetch(
    `${STATE_URL}/${encodeURIComponent(ucode)}?scope=${encodeURIComponent(scope)}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error(`State DELETE Error: ${response.status}`);
  return response.json();
}

export async function readStateApi(ucode: string, scope = "shop:main") {
  const response = await fetch(
    `${STATE_URL}/${encodeURIComponent(ucode)}?scope=${encodeURIComponent(scope)}`
  );
  if (!response.ok) throw new Error(`State READ Error: ${response.status}`);
  return response.json();
}

// ─── Embedding API (mobile sends local embeddings to remote) ───

export async function upsertEmbeddingApi(stateId: string, vector: number[]) {
  const response = await fetch(STATEAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stateId, vector }),
  });
  if (!response.ok) throw new Error(`Embedding UPSERT Error: ${response.status}`);
  return response.json();
}

// ─── Server-side Search API (optional - mobile can also search locally) ───

export async function searchServerApi(vector: number[], scope = "shop:main", limit = 10) {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const response = await fetch(INSTANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Instance CREATE Error: ${response.status}`);
  return response.json();
}

export async function getInstancesByStateApi(stateid: string, scope = "shop:main") {
  const response = await fetch(
    `${INSTANCE_URL}/${encodeURIComponent(stateid)}?scope=${encodeURIComponent(scope)}`
  );
  if (!response.ok) throw new Error(`Instance READ Error: ${response.status}`);
  return response.json();
}

export async function updateInstanceApi(id: string, data: Partial<InstanceData>) {
  const response = await fetch(`${INSTANCE_URL}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Instance UPDATE Error: ${response.status}`);
  return response.json();
}

export async function deleteInstanceApi(id: string) {
  const response = await fetch(`${INSTANCE_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Instance DELETE Error: ${response.status}`);
  return response.json();
}
