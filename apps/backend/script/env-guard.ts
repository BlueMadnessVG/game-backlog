/**
 * Refuses to run developer/setup scripts when pointed at production.
 *
 * These scripts mint plaintext credentials (seed-user.ts), drop the whole
 * public schema (db-reset.ts), or issue long-lived API tokens
 * (create-api-token.ts). None of that is ever safe against a production
 * database, so one shared guard covers all of them instead of each script
 * separately remembering to check APP_ENV.
 *
 * Relies on postgres() (db/index.ts, db-reset.ts) opening the socket
 * LAZILY — only on the first query — so calling this at the top of each
 * script's entry point aborts everything before any connection is made,
 * even though the `db` import already ran.
 */
export function assertNotProduction(): void {
  if (process.env.APP_ENV === "production") {
    console.error(
      "❌ Refusing to run: APP_ENV=production. This script creates credentials or resets data and must never execute against production.",
    );
    process.exit(1);
  }
}