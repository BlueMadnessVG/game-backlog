import postgres from "postgres";
import { readConfig } from "../config";
import { assertNotProduction } from "./env-guard";

const DATABASE_URL = readConfig("database").databaseUrl;

async function resetDatabase() {
  assertNotProduction();

  const sql = postgres(DATABASE_URL as string, { max: 1 });

  try {
    console.log("⚠️  Dropping the public schema (all tables, enums, data)...");
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;

    console.log("🔧 Recreating an empty public schema...");
    await sql`CREATE SCHEMA public`;

    console.log("✅ Database reset — run db:push next to rebuild the schema.");
  } finally {
    await sql.end();
  }
}

resetDatabase().catch((error) => {
  console.error("❌ Failed to reset database:", error);
  process.exit(1);
});
