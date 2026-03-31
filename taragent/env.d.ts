declare namespace Cloudflare {
  interface Env {
    // Turso DBs
    STATES_DB_URL: string;
    STATES_DB_TOKEN: string;
    INSTANCES_DB_URL: string;
    INSTANCES_DB_TOKEN: string;
    // AI
    GROQ_API_KEY: string;
    // Durable Objects
    TarAgent: DurableObjectNamespace<import("./src/agent").TarAgent>;
    ORDER_DO: DurableObjectNamespace<import("./src/do/order").OrderDO>;
    SESSION_DO: DurableObjectNamespace<import("./src/do/session").SessionDO>;
  }
}
interface Env extends Cloudflare.Env {}
