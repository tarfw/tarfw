import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// For local testing, we'll use a local SQLite file
const dbUrl = 'libsql://taragent-tarframework.aws-eu-west-1.turso.io';
const dbToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzM3NDE3NzUsImlkIjoiMDE5Y2ZiM2YtMzkwMS03NTBkLTlkNmQtODZhMWU0MGU0ZThhIiwicmlkIjoiMjZkODVjMGQtNDM4OC00ZTlkLTk1ZjYtNzNkNzdmMGM5NDQ4In0.Uj72uqB8_mWlQokEVaZpVsCjGKgD91wBoKamcBIATuUSzMuD2R2ZzxTq7elTHfMeuBCGzFv1xzc0VWXqzAF9CA';

const db = createClient({
  url: dbUrl,
  authToken: dbToken
});

async function main() {
  console.log("Initializing Cloud database...");
  
  // 1. Read and execute the schema.sql
  const schemaSql = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf-8');
  
  // Split the schema sql into individual statements
  const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
      if (!stmt) continue;
      console.log(`Executing statement: ${stmt.substring(0, 50)}...`);
      try {
          await db.execute(stmt);
      } catch (e: any) {
          console.error(`Error executing statement: ${stmt.substring(0, 50)}...`, e.message);
      }
  }
  
  console.log("Schema created on Turso Cloud.");
  console.log("Cloud database setup complete!");
}

main().catch(console.error);
