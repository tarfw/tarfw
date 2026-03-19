import { createClient, Client, InStatement } from '@libsql/client';

let dbClient: Client | null = null;

/**
 * Singleton-like pattern for the Turso client within a Worker isolate.
 */
export function getDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
      throw new Error("TURSO_DB_URL or TURSO_DB_TOKEN environment variables are not set.");
  }
  
  if (!dbClient) {
    dbClient = createClient({
      url: url,
      authToken: authToken,
    });
  }
  return dbClient;
}
