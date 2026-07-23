import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "❌ DATABASE_URL is not defined in your environment variables.",
  );
}

async function resetDatabase() {
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
