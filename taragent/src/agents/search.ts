import { Client } from '@libsql/client';

export class SearchAgent {
  private db: Client;
  private env: any;

  constructor(db: Client, env: any) {
    // This agent uses the States DB for semantic search
    // Embeddings come from mobile app (local MiniLM) stored in stateai table
    this.db = db;
    this.env = env;
  }

  async processSearch(query: string, scope: string) {
    // Note: Search is now handled entirely on mobile app where embeddings are generated locally
    // This endpoint exists for server-side search if needed (e.g., from web clients)
    // For now, we'll return a message indicating search should be done on mobile
    
    console.log(`Search request for "${query}" in scope ${scope} - delegated to mobile`);
    
    // If we need server-side search, we'd need the query vector passed in
    // For now, return instructions for mobile-based search
    return {
      action: "SEARCH",
      query,
      results: [],
      message: "Semantic search should be performed on mobile app where local embeddings are available"
    };
  }
}
