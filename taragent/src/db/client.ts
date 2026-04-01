import { createClient, type Client } from '@libsql/client';

/**
 * Get the States DB client (state + stateai tables)
 */
export function getStatesDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
    throw new Error("STATES_DB_URL or STATES_DB_TOKEN environment variables are not set.");
  }
  return createClient({
    url: url,
    authToken: authToken,
  });
}

/**
 * Get the Auth DB client (users, sessions, user_scopes tables)
 */
export function getAuthDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
    throw new Error("AUTH_DB_URL or AUTH_DB_TOKEN environment variables are not set.");
  }
  return createClient({ url, authToken });
}

/**
 * Get the Instances DB client (instance + events tables)
 */
export function getInstancesDbClient(url: string, authToken: string): Client {
  if (!url || !authToken) {
    throw new Error("INSTANCES_DB_URL or INSTANCES_DB_TOKEN environment variables are not set.");
  }
  return createClient({
    url: url,
    authToken: authToken,
  });
}
