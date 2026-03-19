import Database from 'libsql'; // Use raw libsql node package for local script
import * as fs from 'fs';
import * as path from 'path';

// For local testing, we'll use a local SQLite file
const dbUrl = 'local.db';

const db = new Database(dbUrl);

async function main() {
  console.log("Initializing local database...");
  
  // 1. Read and execute the schema.sql
  const schemaSql = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf-8');
  
  // Split the schema sql into individual statements
  const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
      try {
          db.exec(stmt);
      } catch (e: any) {
          console.error(`Error executing statement: ${stmt.substring(0, 50)}...`, e.message);
      }
  }
  
  console.log("Schema created.");

  // 2. Insert some dummy data into the `state` table so the Interpreter has something to act on
  console.log("Inserting sample state data...");
  try {
     const insertStmt = db.prepare(`INSERT OR IGNORE INTO state (id, ucode, type, title, scope) 
              VALUES (?, ?, ?, ?, ?)`);
     insertStmt.run('state_product1', 'apple', 'product', 'Fresh Apple', 'shop:ramstore');
     console.log("Sample data inserted.");
  } catch(e: any) {
      console.error("Failed to insert sample data:", e.message);
  }

  console.log("Local database setup complete!");
}

main().catch(console.error);
