import { describe, it, expect, vi } from "vitest";
import { HTTPException } from "hono/http-exception";
import {
  withLock,
  lockKeyToBigInt,
  createPostgresLockClient,
  type AdvisoryLockClient,
} from "../locks";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  postgres: vi.fn(),
}));

vi.mock("postgres", () => ({
  default: mocks.postgres,
}));

const makeFakeClient = () => {
  const acquires: bigint[] = [];
  const releases: bigint[] = [];
  const held = new Map<bigint, number>();

  const client: AdvisoryLockClient = {
    async tryAcquire(key: bigint) {
      acquires.push(key);
      const holders = held.get(key) ?? 0;
      if (holders > 0) return false;
      held.set(key, holders + 1);
      return true;
    },
    async release(key: bigint) {
      releases.push(key);
      const holders = held.get(key) ?? 0;
      if (holders > 0) held.set(key, holders - 1);
    },
  };

  return { client, acquires, releases };
};

const makeNeverClient = (): AdvisoryLockClient => ({
  async tryAcquire() {
    return false;
  },
  async release() {},
});

describe("lockKeyToBigInt", () => {
  it("is deterministic and int8-safe", () => {
    const key = lockKeyToBigInt("sync:steam:user-1");
    expect(key).toBe(lockKeyToBigInt("sync:steam:user-1"));
    expect(key).toBeGreaterThan(0n);
    expect(key).toBeLessThan(2n ** 63n);
  });

  it("produces different keys for different inputs", () => {
    expect(lockKeyToBigInt("sync:steam:user-1")).not.toBe(
      lockKeyToBigInt("sync:psn:user-1"),
    );
  });
});

describe("withLock", () => {
  it("runs the fn and releases the lock", async () => {
    const { client, acquires, releases } = makeFakeClient();

    const result = await withLock("collect:user-1", async () => 42, {
      client,
    });

    expect(result).toBe(42);
    expect(acquires).toHaveLength(1);
    expect(releases).toHaveLength(1);
    expect(acquires[0]).toBe(releases[0]);
  });

  it("coalesces concurrent same-key calls into a single run", async () => {
    const { client, acquires } = makeFakeClient();
    let runs = 0;

    let enter!: () => void;
    let open!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const gate = new Promise<void>((resolve) => (open = resolve));

    const fn = async () => {
      runs += 1;
      enter();
      await gate;
      return "ok";
    };

    const first = withLock("sync:steam:user-1", fn, { client });
    await entered;

    const second = withLock("sync:steam:user-1", fn, { client });
    open();

    await expect(first).resolves.toBe("ok");
    await expect(second).resolves.toBe("ok");
    expect(runs).toBe(1);
    expect(acquires).toHaveLength(1);
  });

  it("runs different keys concurrently", async () => {
    const { client } = makeFakeClient();
    let active = 0;
    let maxActive = 0;
    let started = 0;

    let bothStarted!: () => void;
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const bothStartedPromise = new Promise<void>(
      (resolve) => (bothStarted = resolve),
    );

    const fn = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      started += 1;
      if (started === 2) bothStarted();
      await gate;
      active -= 1;
    };

    const first = withLock("sync:steam:user-1", fn, { client });
    const second = withLock("sync:psn:user-1", fn, { client });

    await bothStartedPromise;
    expect(maxActive).toBe(2);

    open();
    await Promise.all([first, second]);
  });

  it("throws 409 when the lock cannot be acquired before the deadline", async () => {
    const client = makeNeverClient();
    const fn = vi.fn(async () => "never");

    const promise = withLock("sync:steam:user-1", fn, {
      client,
      timeoutMs: 80,
    });

    await expect(promise).rejects.toBeInstanceOf(HTTPException);
    await expect(promise).rejects.toMatchObject({ status: 409 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("clears the in-flight entry after completion so the lock can be re-entered", async () => {
    const { client, acquires } = makeFakeClient();

    await withLock("sync:steam:user-1", async () => "first", { client });
    await withLock("sync:steam:user-1", async () => "second", { client });

    expect(acquires).toHaveLength(2);
  });
});

describe("createPostgresLockClient", () => {
  it("throws when no connection string is available", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => createPostgresLockClient()).toThrow();
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original;
    }
  });

  it("acquires and releases advisory locks via dedicated SQL", async () => {
    mocks.sql.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = String(strings.join("?"));
        if (query.includes("pg_try_advisory_lock")) {
          return [{ locked: true }];
        }
        if (query.includes("pg_advisory_unlock")) {
          return [];
        }
        return [];
      },
    );
    mocks.postgres.mockReturnValue(mocks.sql);

    const client = createPostgresLockClient("postgres://lock-test");

    await expect(client.tryAcquire(9001n)).resolves.toBe(true);
    await expect(client.release(9001n)).resolves.toBeUndefined();

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://lock-test",
      expect.objectContaining({ max: 1 }),
    );
    const serialized = mocks.sql.mock.calls
      .map((call) => String(call[0]?.join("?")))
      .join(" ");
    expect(serialized).toContain("pg_try_advisory_lock");
    expect(serialized).toContain("pg_advisory_unlock");
  });

  it("reports an unacquirable lock as false", async () => {
    mocks.sql.mockImplementation(async () => [{ locked: false }]);
    mocks.postgres.mockReturnValue(mocks.sql);

    const client = createPostgresLockClient("postgres://lock-test");

    await expect(client.tryAcquire(9002n)).resolves.toBe(false);
  });
});