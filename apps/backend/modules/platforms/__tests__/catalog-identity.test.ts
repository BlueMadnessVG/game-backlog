import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { games } from "../../../db/schema";
import { createTestDb, type TestDb } from "../../../tests/test-db";

// A game's identity is its platform plus the platform's own id. These tests
// check the database enforces exactly that, independent of the engine.

describe("catalog identity (games table)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const insert = (values: {
    title: string;
    platform: "steam" | "xbox" | "playstation";
    externalId: string;
  }) => t.db.insert(games).values(values);

  /** The database's own message, which Drizzle wraps as the error's cause. */
  const failureOf = async (attempt: Promise<unknown>) => {
    try {
      await attempt;
      return null;
    } catch (error) {
      const e = error as { message: string; cause?: { message?: string } };
      return `${e.message} ${e.cause?.message ?? ""}`;
    }
  };

  it("rejects a second game with the same platform and external id", async () => {
    await insert({ title: "Doom", platform: "steam", externalId: "379720" });

    const failure = await failureOf(
      insert({ title: "A different title", platform: "steam", externalId: "379720" }),
    );

    expect(failure).toMatch(/games_platform_external_id_idx|unique|duplicate/i);
    expect(await t.db.select().from(games)).toHaveLength(1);
  });

  it("accepts the same title with different external ids on one platform", async () => {
    // PS4 and PS5 versions of a game; a remaster next to its original.
    await insert({ title: "Ghost of Tsushima", platform: "playstation", externalId: "NPWR_PS4" });
    await insert({ title: "Ghost of Tsushima", platform: "playstation", externalId: "NPWR_PS5" });

    expect(await t.db.select().from(games)).toHaveLength(2);
  });

  it("accepts the same external id on different platforms", async () => {
    await insert({ title: "Same id", platform: "steam", externalId: "570" });
    await insert({ title: "Same id", platform: "xbox", externalId: "570" });

    expect(await t.db.select().from(games)).toHaveLength(2);
  });

  it("rejects a game with no external id", async () => {
    const failure = await failureOf(
      t.db.insert(games).values({ title: "No id", platform: "steam", externalId: null as never }),
    );

    expect(failure).toMatch(/external_id|not-null|null value/i);
    expect(await t.db.select().from(games)).toHaveLength(0);
  });
});
