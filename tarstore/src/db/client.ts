import { createClient, Client } from '@libsql/client';

export function getStatesDb(url: string, token: string): Client {
  return createClient({ url, authToken: token });
}

export function getInstancesDb(url: string, token: string): Client {
  return createClient({ url, authToken: token });
}
