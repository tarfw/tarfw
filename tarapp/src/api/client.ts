export const API_BASE_URL = "https://taragent.wetarteam.workers.dev";
export const CHANNEL_URL = `${API_BASE_URL}/api/channel`;
export const STATE_URL = `${API_BASE_URL}/api/state`;

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

// ─── State API (direct CRUD — no trace, no instance, no broadcast) ───

export async function createStateApi(ucode: string, title: string | undefined, payload: any, scope = "shop:main") {
  const response = await fetch(STATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ucode, title, payload, scope }),
  });
  if (!response.ok) throw new Error(`State CREATE Error: ${response.status}`);
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
