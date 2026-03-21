import { createClient, Client } from '@libsql/client';

let statesDbClient: Client | null = null;
let instancesDbClient: Client | null = null;

/**
 * Get the States DB client (state + stateai tables)
 * Uses HTTP-only mode to avoid sync engine issues with Turso
 */
export function getStatesDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
    throw new Error("STATES_DB_URL or STATES_DB_TOKEN environment variables are not set.");
  }
  
  if (!statesDbClient) {
    statesDbClient = createClient({
      url: url,
      authToken: authToken,
    });
  }
  return statesDbClient;
}

/**
 * Get the Instances DB client (instance + trace tables)
 * Uses HTTP-only mode to avoid sync engine issues with Turso
 */
export function getInstancesDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
    throw new Error("INSTANCES_DB_URL or INSTANCES_DB_TOKEN environment variables are not set.");
  }
  
  if (!instancesDbClient) {
    // Force HTTP transport by converting libsql:// to https://
    const httpUrl = url.replace('libsql://', 'https://');
    instancesDbClient = createClient({
      url: httpUrl,
      authToken: authToken,
    });
  }
  return instancesDbClient;
}

// Legacy alias for backward compatibility
export function getDbClient(url: string, authToken: string): Client {
  return getStatesDbClient(url, authToken);
}
