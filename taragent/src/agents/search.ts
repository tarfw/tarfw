import { Client } from '@libsql/client';

export class SearchAgent {
  private db: Client;
  private env: any;

  constructor(db: Client, env: any) {
    this.db = db;
    this.env = env;
  }

  async processSearch(query: string, scope: string) {
    if (!this.env.AI) {
      throw new Error("AI binding is missing. Cannot perform semantic search.");
    }

    console.log(`Searching for "${query}" in scope ${scope}`);
    
    // 1. Embed the query
    const embedResp = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
    const vec = embedResp.data[0];
    const floatArray = Array.from(vec);
    const embeddingStr = `[${floatArray.join(',')}]`;

    // 2. Perform vector search in Turso
    // vector_distance_cos returns similarity distance (lower is closer matching)
    const result = await this.db.execute({
      sql: `SELECT ucode, title, payload, vector_distance_cos(embedding, vector(?)) as distance
            FROM state 
            WHERE scope = ? AND embedding IS NOT NULL
            ORDER BY distance ASC
            LIMIT 5`,
      args: [embeddingStr, scope]
    });

    return {
      action: "SEARCH",
      query,
      results: result.rows
    };
  }
}
