declare namespace Cloudflare {
  interface Env {
    // Turso DBs
    STATES_DB_URL: string;
    STATES_DB_TOKEN: string;
    INSTANCES_DB_URL: string;
    INSTANCES_DB_TOKEN: string;
    // Auth DB (Turso)
    AUTH_DB_URL: string;
    AUTH_DB_TOKEN: string;
    // AI
    GROQ_API_KEY: string;
    // Auth
    GOOGLE_CLIENT_ID: string;
    // Durable Objects
    TarAgent: DurableObjectNamespace<import("./src/agent").TarAgent>;
    EVENT_HUB: DurableObjectNamespace<import("./src/do/eventhub").EventHub>;
  }
}
interface Env extends Cloudflare.Env {}
