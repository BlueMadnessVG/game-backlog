import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";

import * as schema from "../db/schema";
import type { DbClient } from "../db";

/**
 * A real Postgres for tests: PGlite runs in-process (WASM), so there is no
 * server, no Docker and no DATABASE_URL.
 *
 * Every migration in db/migrations is replayed, so the schema under test is
 * what a deployed database gets, and a migration that doesn't build the
 * schema the code expects fails here instead of in production.
 *
 * Use it wherever a test must prove what a query does — above all that a
 * query filters by user. A mocked `where()` ignores its argument and can't.
 *
 * One instance per test file (startup is ~1s); call `reset()` between tests.
 */
export async function createTestDb() {
  const client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, {
    migrationsFolder: path.join(import.meta.dirname, "../db/migrations"),
  });

  return {
    // Same query-builder surface as the postgres-js client the app uses.
    db: pg as unknown as DbClient,
    /** Empties every table, keeping the schema. */
    async reset() {
      const { rows } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );
      if (rows.length === 0) return;
      const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
      await pg.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
    },
    close: () => client.close(),
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
