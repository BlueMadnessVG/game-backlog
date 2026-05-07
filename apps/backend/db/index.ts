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
