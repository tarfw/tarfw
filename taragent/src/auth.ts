import { type Client } from '@libsql/client';
import { getAuthDbClient } from './db/client';

// ─── Types ───
export interface AuthUser {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthSession {
  token: string;
  expires_at: string;
}

// ─── No hardcoded default — each new user gets a unique store scope ───

// ─── Get auth DB from env ───
export function authDb(env: Env): Client {
  return getAuthDbClient(env.AUTH_DB_URL, env.AUTH_DB_TOKEN);
}

// ─── Google Token Verification ───
export async function verifyGoogleToken(token: string, clientId?: string): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

    if (response.ok) {
      const data = await response.json() as Record<string, string>;
      
      // Verify audience if provided
      if (clientId && data.aud !== clientId) {
        console.error('[Auth] Token audience mismatch:', data.aud, 'expected:', clientId);
        return null;
      }
      
      if (!data.sub || !data.email) return null;
      return { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
    }

    // REMOVED INSECURE FALLBACK: decoding JWT directly without signature verification is unsafe.
    // If tokeninfo fails, we simply reject the token.
    return null;
  } catch (error) {
    console.error('[Auth] verifyGoogleToken error:', error);
    return null;
  }
}

// ─── User Management ───
export async function upsertGoogleUser(db: Client, googleUser: { sub: string; email: string; name?: string; picture?: string }): Promise<AuthUser> {
  const existing = await db.execute({
    sql: 'SELECT id, google_id, email, name, picture FROM users WHERE google_id = ? OR email = ?',
    args: [googleUser.sub, googleUser.email],
  });

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    await db.execute({
      sql: "UPDATE users SET name = ?, picture = ?, updated_at = datetime('now') WHERE id = ?",
      args: [googleUser.name || user.name, googleUser.picture || user.picture, user.id],
    });
    return { id: user.id as string, google_id: user.google_id as string, email: user.email as string, name: (user.name as string) || null, picture: (user.picture as string) || null };
  }

  const userId = crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)',
    args: [userId, googleUser.sub, googleUser.email, googleUser.name || null, googleUser.picture || null],
  });

  // Create a unique default store for new user
  const storeId = crypto.randomUUID();
  await db.execute({
    sql: "INSERT OR IGNORE INTO user_scopes (user_id, scope, role) VALUES (?, ?, 'owner')",
    args: [userId, `shop:${storeId}`],
  });

  return { id: userId, google_id: googleUser.sub, email: googleUser.email, name: googleUser.name || null, picture: googleUser.picture || null };
}

// ─── Session Management ───
export async function createSession(db: Client, userId: string): Promise<AuthSession> {
  const token = crypto.randomUUID() + '.' + Date.now();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [token, userId, expiresAt],
  });

  return { token, expires_at: expiresAt };
}

export async function validateSession(db: Client, token: string): Promise<{ valid: boolean; user_id?: string; user?: AuthUser }> {
  const result = await db.execute({
    sql: `SELECT s.user_id, s.expires_at, u.id, u.google_id, u.email, u.name, u.picture
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.token = ?`,
    args: [token],
  });

  if (result.rows.length === 0) return { valid: false };

  const row = result.rows[0];
  if (new Date(row.expires_at as string) < new Date()) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    return { valid: false };
  }

  return {
    valid: true,
    user_id: row.user_id as string,
    user: { id: row.id as string, google_id: row.google_id as string, email: row.email as string, name: row.name as string | null, picture: row.picture as string | null },
  };
}

export async function deleteSession(db: Client, token: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

// ─── Scope Management ───
export async function getUserScopes(db: Client, userId: string): Promise<string[]> {
  const result = await db.execute({ sql: 'SELECT scope FROM user_scopes WHERE user_id = ?', args: [userId] });
  return result.rows.map((r) => r.scope as string);
}

export async function getUserScopesWithRoles(db: Client, userId: string): Promise<{ scope: string; role: string }[]> {
  const result = await db.execute({ sql: 'SELECT scope, role FROM user_scopes WHERE user_id = ?', args: [userId] });
  return result.rows.map((r) => ({ scope: r.scope as string, role: (r.role as string) || 'owner' }));
}

export async function addScopeToUser(db: Client, userId: string, scope: string, role = 'owner'): Promise<void> {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO user_scopes (user_id, scope, role) VALUES (?, ?, ?)',
    args: [userId, scope, role],
  });
}

// ─── Auth Middleware Helper ───
export async function authenticateRequest(env: Env, request: Request): Promise<{ user: AuthUser; user_id: string; scopes: string[] } | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const db = authDb(env);
  const validation = await validateSession(db, authHeader.slice(7));

  if (!validation.valid || !validation.user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const scopes = await getUserScopes(db, validation.user_id!);
  return { user: validation.user, user_id: validation.user_id!, scopes };
}
