import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { HTTPException } from "hono/http-exception";

import { createPostgresLockClient, lockKeyToBigInt, withLock } from "../locks";
import { startRealPostgres, type RealPostgres } from "../../tests/real-postgres";

/**
 * The advisory lock against a REAL Postgres server. locks.test.ts proves the
 * waiting/coalescing logic with a fake client; this proves the SQL and the
 * guarantee the app relies on: two separate sessions (two app processes)
 * cannot hold the same key at once, and a session that dies frees its locks.
 * PGlite can't show that: it has one session, where these locks are reentrant.
 */
describe("advisory locks (real Postgres server)", () => {
  let server: RealPostgres;
  const clients: Array<ReturnType<typeof createPostgresLockClient>> = [];

  // Each client is its own single-connection session.
  const session = () => {
    const client = createPostgresLockClient(server.url);
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    server = await startRealPostgres();
  }, 120_000);

  afterEach(async () => {
    // Closing a session frees whatever it still holds, isolating the tests.
    await Promise.all(clients.splice(0).map((c) => c.close().catch(() => {})));
  });

  afterAll(async () => {
    await server?.stop();
  }, 60_000);

  const hi = (n: number) => BigInt(n) << 32n;

  it("lets one session hold a key and refuses a second, until the first releases", async () => {
    const a = session();
    const b = session();
    const key = lockKeyToBigInt("sync:steam:user-1");

    expect(await a.tryAcquire(key)).toBe(true);
    expect(await b.tryAcquire(key)).toBe(false);

    await a.release(key);

    expect(await b.tryAcquire(key)).toBe(true);
  });

  it("keeps different keys independent, even when they share their low 32 bits", async () => {
    const a = session();
    const b = session();
    // Same `lo` half, different `hi`: both halves matter to the key.
    const k1 = hi(1) | 5n;
    const k2 = hi(2) | 5n;

    expect(await a.tryAcquire(k1)).toBe(true);

    expect(await b.tryAcquire(k2)).toBe(true);
    expect(await b.tryAcquire(k1)).toBe(false);
  });

  it("handles a key whose halves exceed the signed 32-bit range", async () => {
    const a = session();
    const b = session();
    // lo = 0xFFFFFFFF becomes -1 as a signed int4; hi = 0x7FFFFFFF is the max.
    const key = (0x7fffffffn << 32n) | 0xffffffffn;

    expect(await a.tryAcquire(key)).toBe(true);
    expect(await b.tryAcquire(key)).toBe(false);
    await a.release(key);
    expect(await b.tryAcquire(key)).toBe(true);
  });

  it("serializes the same key across two separate processes", async () => {
    // Two copies of the module = two processes: each has its own in-memory
    // "already running" map, so only the database lock can order them.
    const first = await import("../locks");
    vi.resetModules();
    const second = await import("../locks");
    expect(second.withLock).not.toBe(first.withLock);

    const events: string[] = [];
    const slow = first.withLock(
      "sync:psn:user-1",
      async () => {
        events.push("first start");
        await new Promise((r) => setTimeout(r, 300));
        events.push("first end");
      },
      { client: session() },
    );
    // Let the first run take the lock before the second asks for it.
    await vi.waitFor(() => expect(events).toEqual(["first start"]));

    await second.withLock(
      "sync:psn:user-1",
      async () => {
        events.push("second start");
      },
      { client: session() },
    );
    await slow;

    expect(events).toEqual(["first start", "first end", "second start"]);
  });

  it("gives up with 409 SYNC_IN_PROGRESS when another session keeps the key, and never runs", async () => {
    const holder = session();
    const key = "sync:xbox:user-1";
    await holder.tryAcquire(lockKeyToBigInt(key));
    const fn = vi.fn(async () => "ran");

    const failure = await withLock(key, fn, {
      client: session(),
      timeoutMs: 200,
    }).catch((e) => e);

    expect(failure).toBeInstanceOf(HTTPException);
    expect(failure.status).toBe(409);
    expect(failure.message).toBe("SYNC_IN_PROGRESS");
    expect(fn).not.toHaveBeenCalled();
  });

  it("frees the lock when the holding session dies without releasing", async () => {
    const crashed = session();
    const survivor = session();
    const key = lockKeyToBigInt("sync:steam:user-2");
    await crashed.tryAcquire(key);
    expect(await survivor.tryAcquire(key)).toBe(false);

    await crashed.close(); // the connection drops, no release() call

    // Postgres notices the closed session on its own schedule.
    await vi.waitFor(async () => expect(await survivor.tryAcquire(key)).toBe(true));
  });

  it("releases the lock when the work fails", async () => {
    const key = "sync:steam:user-3";

    await expect(
      withLock(
        key,
        async () => {
          throw new Error("sync blew up");
        },
        { client: session() },
      ),
    ).rejects.toThrow("sync blew up");

    expect(await session().tryAcquire(lockKeyToBigInt(key))).toBe(true);
  });
});
