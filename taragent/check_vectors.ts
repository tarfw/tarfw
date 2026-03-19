import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DB_URL as string,
  authToken: process.env.TURSO_DB_TOKEN as string,
});

async function check() {
  const result = await db.execute("SELECT ucode, typeof(embedding) as type, length(embedding) as len FROM state WHERE embedding IS NOT NULL");
  console.log(JSON.stringify(result.rows, null, 2));
}

check().catch(console.error);
