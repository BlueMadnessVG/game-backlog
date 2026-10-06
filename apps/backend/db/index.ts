import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is missing. Connection failed.");
}

const client = postgres(DATABASE_URL, {
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;

/**
 * Closes the underlying postgres.js pool.
 *
 * Required by one-shot scripts (script/seed-user.ts): the pool keeps handles
 * open and would hold the event loop alive forever, so the process would hang
 * after finishing its work. The long-running server never calls this.
 */
export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
}
