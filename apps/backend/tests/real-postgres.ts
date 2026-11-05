import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A real Postgres SERVER for the few tests that PGlite cannot serve: ones that
 * need several separate database sessions (advisory locks only contend between
 * sessions; PGlite has exactly one). See tests/test-db.ts for the default,
 * faster in-process database every other test uses.
 *
 * Starts a throwaway cluster on a free port in a temp directory, with no Docker
 * and no DATABASE_URL. The first start also runs initdb, so give the
 * `beforeAll` a generous timeout (the first-ever run additionally downloads
 * nothing: the binaries ship inside the `embedded-postgres` package).
 *
 * One server per test file; always call `stop()` in `afterAll`.
 */
export async function startRealPostgres() {
  const port = await freePort();
  const dir = await mkdtemp(path.join(tmpdir(), "backlog-pg-"));
  const password = "test-password";

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, "data"),
    port,
    user: "postgres",
    password,
    persistent: false,
    // Server logs are noise unless something is wrong; errors still surface.
    onLog: () => {},
    onError: () => {},
  });

  try {
    await pg.initialise();
    await pg.start();
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return {
    /** Connection string for postgres-js / any client. */
    url: `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
    async stop() {
      await pg.stop().catch(() => {});
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export type RealPostgres = Awaited<ReturnType<typeof startRealPostgres>>;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find a free port"));
      }
    });
  });
}
