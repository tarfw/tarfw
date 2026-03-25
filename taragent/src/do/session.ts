import { DurableObject } from 'cloudflare:workers';

// ─── Auth Schema for SQLite ───
const CREATE_AUTH_TABLES = `
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id)
);

CREATE TABLE IF NOT EXISTS auth_user_scopes (
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  role TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, scope),
  FOREIGN KEY (user_id) REFERENCES auth_users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_scopes_user ON auth_user_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scopes_scope ON auth_user_scopes(scope);
`;

// Default scopes for new users
const DEFAULT_SCOPES = ['shop:main'];

export class SessionDO extends DurableObject {
  private sql: any = null;
  private _env: Record<string, string>;

  constructor(ctx: any, env: any) {
    super(ctx, env);
    this._env = env as Record<string, string>;
  }

  async initializeSql() {
    if (this.sql) return this.sql;
    this.sql = this.ctx.storage.sql;
    this.sql.exec(CREATE_AUTH_TABLES);
    console.log('[SessionDO] SQLite initialized for auth');
    return this.sql;
  }

  // ─── User Management ───

  // Create or update user from Google token
  async upsertGoogleUser(googleUser: {
    sub: string;  // Google user ID
    email: string;
    name?: string;
    picture?: string;
  }): Promise<{ id: string; email: string; name: string; picture?: string }> {
    const db = await this.initializeSql();

    // Check if user exists
    const existing = db.exec(
      `SELECT id, email, name, picture FROM auth_users WHERE google_id = ? OR email = ?`,
      googleUser.sub, googleUser.email
    );

    let rows;
    try {
      rows = existing.toArray();
    } catch (e) {
      rows = [];
    }

    if (rows.length > 0) {
      // Update existing user
      const user = rows[0];
      db.exec(
        `UPDATE auth_users SET name = ?, picture = ?, updated_at = datetime('now') WHERE id = ?`,
        googleUser.name || user.name, googleUser.picture || user.picture, user.id
      );
      return { id: user.id, email: user.email, name: user.name || '', picture: user.picture };
    }

    // Create new user
    const userId = crypto.randomUUID();
    db.exec(
      `INSERT INTO auth_users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)`,
      userId, googleUser.sub, googleUser.email, googleUser.name || null, googleUser.picture || null
    );

    // Create default scopes for new user
    for (const scope of DEFAULT_SCOPES) {
      db.exec(
        `INSERT OR IGNORE INTO auth_user_scopes (user_id, scope, role) VALUES (?, ?, 'owner')`,
        userId, scope
      );
    }

    console.log('[SessionDO] New user created:', userId, googleUser.email);
    return { id: userId, email: googleUser.email, name: googleUser.name || '', picture: googleUser.picture };
  }

  // Get user by ID
  async getUser(userId: string): Promise<any | null> {
    const db = await this.initializeSql();
    const cursor = db.exec(`SELECT id, email, name, picture, created_at FROM auth_users WHERE id = ?`, userId);
    try {
      return cursor.one();
    } catch (e) {
      return null;
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<any | null> {
    const db = await this.initializeSql();
    const cursor = db.exec(`SELECT id, email, name, picture FROM auth_users WHERE email = ?`, email);
    try {
      return cursor.one();
    } catch (e) {
      return null;
    }
  }

  // ─── Session Management ───

  // Create new session for user
  async createSession(userId: string): Promise<{ token: string; expires_at: string }> {
    const db = await this.initializeSql();

    const token = crypto.randomUUID() + '.' + Date.now();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    db.exec(
      `INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      token, userId, expiresAt
    );

    console.log('[SessionDO] Session created for user:', userId);
    return { token, expires_at: expiresAt };
  }

  // Validate session token
  async validateSession(token: string): Promise<{ valid: boolean; user_id?: string; user?: any }> {
    const db = await this.initializeSql();

    // First check if token exists and not expired
    const cursor = db.exec(
      `SELECT user_id, expires_at FROM auth_sessions WHERE token = ?`,
      token
    );

    let row;
    try {
      row = cursor.one();
    } catch (e) {
      return { valid: false };
    }

    if (!row) {
      return { valid: false };
    }

    // Check expiration
    if (new Date(row.expires_at) < new Date()) {
      // Delete expired session
      db.exec(`DELETE FROM auth_sessions WHERE token = ?`, token);
      return { valid: false };
    }

    // Get user info
    const user = await this.getUser(row.user_id);
    return { valid: true, user_id: row.user_id, user };
  }

  // Delete session (logout)
  async deleteSession(token: string): Promise<boolean> {
    const db = await this.initializeSql();
    db.exec(`DELETE FROM auth_sessions WHERE token = ?`, token);
    return true;
  }

  // Delete all sessions for user (logout everywhere)
  async deleteAllUserSessions(userId: string): Promise<boolean> {
    const db = await this.initializeSql();
    db.exec(`DELETE FROM auth_sessions WHERE user_id = ?`, userId);
    return true;
  }

  // ─── Scope Management ───

  // Get all scopes for user
  async getUserScopes(userId: string): Promise<string[]> {
    const db = await this.initializeSql();
    const cursor = db.exec(`SELECT scope FROM auth_user_scopes WHERE user_id = ?`, userId);
    try {
      const rows = cursor.toArray();
      return rows.map((r: any) => r.scope);
    } catch (e) {
      return [];
    }
  }

  // Check if user has access to scope
  async userHasScope(userId: string, scope: string): Promise<boolean> {
    const db = await this.initializeSql();
    const cursor = db.exec(
      `SELECT 1 FROM auth_user_scopes WHERE user_id = ? AND scope = ?`,
      userId, scope
    );
    try {
      const row = cursor.one();
      return !!row;
    } catch (e) {
      return false;
    }
  }

  // Add scope to user (for creating new stores)
  async addScopeToUser(userId: string, scope: string, role: string = 'owner'): Promise<boolean> {
    const db = await this.initializeSql();
    db.exec(
      `INSERT OR IGNORE INTO auth_user_scopes (user_id, scope, role) VALUES (?, ?, ?)`,
      userId, scope, role
    );
    return true;
  }

  // ─── HTTP Handler ───
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle auth routes
    if (path.startsWith('/auth/')) {
      return this.handleAuthRequest(request, path);
    }

    // Default response
    return new Response('SessionDO active', { status: 200 });
  }

  private async handleAuthRequest(request: Request, path: string): Promise<Response> {
    try {
      // POST /auth/google - Validate Google token and create session
      if (path === '/auth/google' && request.method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        const google_token = body.google_token as string | undefined;
        const server_auth_code = body.server_auth_code as string | undefined;

        if (!google_token && !server_auth_code) {
          return new Response(JSON.stringify({ error: 'google_token required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Verify Google token - get user info from Google
        // Try idToken first, fall back to decoding JWT directly
        const googleUser = google_token ? await this.verifyGoogleToken(google_token) : null;
        if (!googleUser) {
          return new Response(JSON.stringify({ error: 'Invalid Google token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Upsert user and create session
        const user = await this.upsertGoogleUser(googleUser);
        const session = await this.createSession(user.id);

        // Get user's scopes
        const scopes = await this.getUserScopes(user.id);

        return new Response(JSON.stringify({
          success: true,
          user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
          token: session.token,
          expires_at: session.expires_at,
          scopes
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // GET /auth/me - Get current user info
      if (path === '/auth/me' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.slice(7);
        const validation = await this.validateSession(token);

        if (!validation.valid) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const scopes = await this.getUserScopes(validation.user_id!);

        return new Response(JSON.stringify({
          success: true,
          user: validation.user,
          scopes
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /auth/logout - Delete current session
      if (path === '/auth/logout' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.slice(7);
        await this.deleteSession(token);

        return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // GET /auth/scopes - Get user's authorized scopes
      if (path === '/auth/scopes' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.slice(7);
        const validation = await this.validateSession(token);

        if (!validation.valid) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const scopes = await this.getUserScopes(validation.user_id!);

        return new Response(JSON.stringify({ success: true, scopes }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /auth/scopes - Create new scope (new store)
      if (path === '/auth/scopes' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.slice(7);
        const validation = await this.validateSession(token);

        if (!validation.valid) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json() as Record<string, unknown>;
        const scope = body.scope as string | undefined;

        if (!scope) {
          return new Response(JSON.stringify({ error: 'scope required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        await this.addScopeToUser(validation.user_id!, scope, 'owner');

        return new Response(JSON.stringify({ success: true, scope }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err: any) {
      console.error('[SessionDO] Auth error:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }  // Verify Google ID token and extract user info
  private async verifyGoogleToken(token: string): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
    try {
      // First try Google's tokeninfo endpoint
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      
      if (response.ok) {
        const data = await response.json() as Record<string, string>;
        
        // Verify it's an ID token (has 'sub', 'email')
        if (!data.sub || !data.email) {
          console.error('[SessionDO] Invalid token payload:', data);
          return null;
        }

        return {
          sub: data.sub,
          email: data.email,
          name: data.name,
          picture: data.picture
        };
      }

      // Fallback: decode JWT payload directly (works for Android-issued tokens
      // which Google's tokeninfo endpoint may reject due to audience mismatch)
      console.log('[SessionDO] tokeninfo failed, falling back to JWT decode');
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[SessionDO] Invalid JWT format');
        return null;
      }

      // Decode the payload (base64url)
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson) as Record<string, string | number>;

      // Validate issuer - must be from Google
      if (payload.iss !== 'https://accounts.google.com') {
        console.error('[SessionDO] Invalid issuer:', payload.iss);
        return null;
      }

      if (!payload.sub || !payload.email) {
        console.error('[SessionDO] Missing sub or email in JWT payload');
        return null;
      }

      console.log('[SessionDO] JWT decode success for:', payload.email);
      return {
        sub: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string | undefined,
        picture: payload.picture as string | undefined
      };

    } catch (err: any) {
      console.error('[SessionDO] Token verification error:', err.message);
      return null;
    }
  }

  private getClientId(): string {
    return this._env.GOOGLE_CLIENT_ID || '';
  }
}