import { createHash } from "node:crypto";
import postgres from "postgres";
import { HTTPException } from "hono/http-exception";

/**
 * Postgres advisory-lock client.
 *
 * `tryAcquire`/`release` must run against the same session, so the default
 * implementation opens a dedicated single-connection client (`max: 1`)
 * instead of reusing the app pool (`max: 10`), whose shared connections
 * would silently mis-release advisory locks.
 */
export type AdvisoryLockClient = {
  tryAcquire(key: bigint): Promise<boolean>;
  release(key: bigint): Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hashes a semantic lock key (e.g. `"sync:steam:user-1"`) into a stable,
 * positive `int8` value suitable for advisory locking.
 */
export function lockKeyToBigInt(key: string): bigint {
  const digest = createHash("sha256").update(key).digest();
  const value = digest.subarray(0, 8).readBigUInt64BE();
  return value & (2n ** 63n - 1n);
}

/**
 * Splits an `int8` lock key into two signed 32-bit halves so it can be
 * passed to the two-argument form of `pg_try_advisory_lock`, which
 * postgres-js parameter typing supports.
 */
function toTwoInt4(key: bigint): { hi: number; lo: number } {
  const hi = Number((key >> 32n) & 0xffffffffn) | 0;
  const lo = Number(key & 0xffffffffn) | 0;
  return { hi, lo };
}

/**
 * Builds an {@link AdvisoryLockClient} backed by a dedicated
 * single-session PostgreSQL connection.
 *
 * @param connectionString - Postgres connection string. Defaults to
 *   `DATABASE_URL`.
 * @throws {Error} When no connection string is available.
 */
export function createPostgresLockClient(
  connectionString = process.env.DATABASE_URL,
): AdvisoryLockClient {
  if (!connectionString) {
    throw new Error(
      "❌ DATABASE_URL is missing. Advisory locks require a connection string.",
    );
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  return {
    async tryAcquire(key: bigint): Promise<boolean> {
      const { hi, lo } = toTwoInt4(key);
      const result = (await sql`
        select pg_try_advisory_lock(${hi}, ${lo}) as "locked"
      `) as unknown as Array<{ locked: boolean }>;
      return result[0]?.locked ?? false;
    },
    async release(key: bigint): Promise<void> {
      const { hi, lo } = toTwoInt4(key);
      await sql`select pg_advisory_unlock(${hi}, ${lo})`;
    },
  };
}

let defaultClient: AdvisoryLockClient | undefined;

const getDefaultClient = (): AdvisoryLockClient => {
  return (defaultClient ??= createPostgresLockClient());
};

/**
 * Tracks in-flight runs per key so concurrent same-key callers within the
 * same process join the existing run instead of starting a duplicate one.
 */
const inFlight = new Map<string, Promise<unknown>>();

export interface WithLockOptions {
  client?: AdvisoryLockClient;
  timeoutMs?: number;
}

/**
 * Runs `fn` while holding a Postgres advisory lock for `key`.
 *
 * Guarantees:
 * - Same-key calls within the same process are coalesced into a single run.
 * - Same-key calls across processes are serialized by the advisory lock.
 * - The lock is released when `fn` settles, or automatically when the
 *   acquiring connection drops (crash-safe).
 *
 * @param key - Semantic lock key, e.g. `"sync:steam:user-1"`.
 * @param fn - The critical section to run while holding the lock.
 * @param options - Optional custom `client` (tests) or `timeoutMs` override.
 * @returns The result of `fn`.
 * @throws {HTTPException} 409 when the lock cannot be acquired before the
 *   timeout elapses.
 */
export function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: WithLockOptions = {},
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const run = (async () => {
    const client = options.client ?? getDefaultClient();
    const lockKey = lockKeyToBigInt(key);
    const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    while (!(await client.tryAcquire(lockKey))) {
      if (Date.now() >= deadline) {
        throw new HTTPException(409, {
          message: "SYNC_IN_PROGRESS",
        });
      }
      await sleep(RETRY_DELAY_MS);
    }

    try {
      return await fn();
    } finally {
      await client.release(lockKey);
    }
  })();

  inFlight.set(key, run);
  void run
    .finally(() => {
      inFlight.delete(key);
    })
    .catch(() => {});

  return run;
}