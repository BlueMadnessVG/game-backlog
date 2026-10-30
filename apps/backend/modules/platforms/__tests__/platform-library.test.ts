import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { AchievementSchema } from "@repo/shared";

import {
  achievements,
  games,
  userAchievements,
  userGames,
} from "../../../db/schema";
import type { AdvisoryLockClient } from "../../../lib/locks";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import { seedUser } from "../../../tests/seed";
import { GameNotFoundError } from "../errors";
import { PlatformLibrary } from "../platform-library";
import type {
  AchievementsOutcome,
  NormalizedAchievement,
  OwnedGame,
} from "../platform-adapter";

// PlatformLibrary is the rules every platform shares. These tests give it a
// fake adapter and a real Postgres, so each rule is checked through the
// engine's own interface, the way the controllers use it.

const owned = (overrides: Partial<OwnedGame> = {}): OwnedGame => ({
  externalId: "g1",
  title: "Game 1",
  iconUrl: null,
  coverUrl: null,
  bannerUrl: null,
  playTimeMinutes: 10,
  lastPlayedAt: null,
  completionPercentage: null,
  ...overrides,
});

const ach = (
  externalKey: string,
  achieved: boolean,
  overrides: Partial<NormalizedAchievement> = {},
): NormalizedAchievement => ({
  externalKey,
  name: `Achievement ${externalKey}`,
  description: null,
  hidden: false,
  iconUrl: null,
  iconGrayUrl: null,
  globalPercentage: null,
  points: null,
  tier: null,
  achieved,
  unlockedAt: achieved ? new Date("2026-03-01T00:00:00Z") : null,
  ...overrides,
});

const ok = (...list: NormalizedAchievement[]): AchievementsOutcome => ({
  status: "ok",
  achievements: list,
});

const makeAdapter = () => ({
  platform: "steam" as const,
  batch: { size: 2, delayMs: 0 },
  enrichCovers: false,
  linkSchema: v.object({}),
  link: vi.fn(async (..._args: unknown[]): Promise<object> => ({ displayName: "Alice" })),
  loadAccount: vi.fn(async (..._args: unknown[]): Promise<object | null> => ({ id: "acct" })),
  fetchOwnedGames: vi.fn(async (..._args: unknown[]): Promise<OwnedGame[]> => []),
  fetchAchievements: vi.fn(
    async (..._args: unknown[]): Promise<AchievementsOutcome> => ok(),
  ),
});

const noopLock: AdvisoryLockClient = {
  tryAcquire: async () => true,
  release: async () => undefined,
};

describe("PlatformLibrary", () => {
  let t: TestDb;
  let adapter: ReturnType<typeof makeAdapter>;
  let library: PlatformLibrary;

  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    adapter = makeAdapter();
    library = new PlatformLibrary(t.db, adapter as never, noopLock);
  });

  const userGameFor = async (userId: string, gameId: string) =>
    (
      await t.db
        .select()
        .from(userGames)
        .where(eq(userGames.userId, userId))
    ).find((row) => row.gameId === gameId)!;

  /** Syncs the library for `userId` and returns the catalog id of a game. */
  const syncLibrary = async (userId: string, list: OwnedGame[]) => {
    adapter.fetchOwnedGames.mockResolvedValue(list);
    return (await library.syncGames(userId)).map((g) => g.gameId);
  };

  describe("syncGames", () => {
    it("returns the catalog ids of the user's games, not their user_games row ids", async () => {
      // Regression: the controllers used to pass user_games.id to the
      // background achievement sync, which looks games up by games.id, so it
      // never synced anything.
      const alice = await seedUser(t.db, "alice");

      const gameIds = await syncLibrary(alice, [owned()]);

      const [catalogRow] = await t.db.select().from(games);
      const [ownershipRow] = await t.db.select().from(userGames);
      expect(gameIds).toEqual([catalogRow!.id]);
      expect(gameIds[0]).not.toBe(ownershipRow!.id);
    });

    it("writes the catalog row keyed by platform and external id", async () => {
      const alice = await seedUser(t.db, "alice");

      await syncLibrary(alice, [
        owned({ externalId: "570", title: "Dota 2", metadata: { svc: "trophy" } }),
      ]);

      const [game] = await t.db.select().from(games);
      expect(game).toMatchObject({
        platform: "steam",
        externalId: "570",
        title: "Dota 2",
        metadata: { svc: "trophy" },
      });
    });

    it("is idempotent: syncing again updates rows in place", async () => {
      const alice = await seedUser(t.db, "alice");
      const first = await syncLibrary(alice, [owned({ title: "Old Title" })]);

      const second = await syncLibrary(alice, [owned({ title: "New Title" })]);

      expect(second).toEqual(first);
      expect(await t.db.select().from(games)).toHaveLength(1);
      expect(await t.db.select().from(userGames)).toHaveLength(1);
      expect((await t.db.select().from(games))[0]!.title).toBe("New Title");
    });

    it("keeps a cover that is already set instead of overwriting it", async () => {
      // IGDB fills in covers for platforms that have none; a later sync that
      // reports no cover must not wipe it.
      const alice = await seedUser(t.db, "alice");
      await syncLibrary(alice, [owned({ coverUrl: "https://igdb/cover.jpg" })]);

      await syncLibrary(alice, [owned({ coverUrl: null })]);

      expect((await t.db.select().from(games))[0]!.coverUrl).toBe(
        "https://igdb/cover.jpg",
      );
    });

    it("gives each user their own progress on the same catalog game", async () => {
      const alice = await seedUser(t.db, "alice");
      const bob = await seedUser(t.db, "bob");

      const [aliceGame] = await syncLibrary(alice, [owned({ playTimeMinutes: 900 })]);
      const [bobGame] = await syncLibrary(bob, [owned({ playTimeMinutes: 5 })]);

      expect(aliceGame).toBe(bobGame);
      expect(await t.db.select().from(games)).toHaveLength(1);
      expect((await userGameFor(alice, aliceGame!)).playTime).toBe(900);
      expect((await userGameFor(bob, bobGame!)).playTime).toBe(5);
    });

    it("doesn't reset play time or completion the platform doesn't report", async () => {
      // PSN has no play time; Steam reports completion only via achievements.
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [
        owned({ playTimeMinutes: 100, completionPercentage: 40 }),
      ]);

      await syncLibrary(alice, [
        owned({ playTimeMinutes: null, completionPercentage: null }),
      ]);

      expect(await userGameFor(alice, gameId!)).toMatchObject({
        playTime: 100,
        completionPercentage: 40,
      });
    });

    it("derives status from progress", async () => {
      const alice = await seedUser(t.db, "alice");
      const recent = new Date();

      await syncLibrary(alice, [
        owned({ externalId: "done", title: "Done", completionPercentage: 100 }),
        owned({ externalId: "plat", title: "Plat", completionPercentage: 30, platinumEarned: true }),
        owned({ externalId: "playing", title: "Playing", lastPlayedAt: recent }),
        owned({ externalId: "new", title: "New", playTimeMinutes: 0 }),
      ]);

      const rows = await t.db
        .select({ title: games.title, status: userGames.status })
        .from(userGames)
        .innerJoin(games, eq(games.id, userGames.gameId));
      const status = Object.fromEntries(rows.map((r) => [r.title, r.status]));
      expect(status).toEqual({
        Done: "completed",
        Plat: "completed",
        Playing: "in-progress",
        New: "backlog",
      });
    });

    it("collapses entries that share a title, keeping the one with the most progress", async () => {
      // TRANSITIONAL: the catalog still rejects two rows with one title.
      // Replaced by "two games" when the (title, platform) unique goes.
      const alice = await seedUser(t.db, "alice");

      const gameIds = await syncLibrary(alice, [
        owned({ externalId: "a", title: "Doom", playTimeMinutes: 30 }),
        owned({ externalId: "b", title: "Doom", playTimeMinutes: 900 }),
      ]);

      expect(gameIds).toHaveLength(1);
      expect((await t.db.select().from(games))[0]!.externalId).toBe("b");
    });

    it("writes nothing when the platform reports no games", async () => {
      const alice = await seedUser(t.db, "alice");

      expect(await syncLibrary(alice, [])).toEqual([]);
      expect(await t.db.select().from(games)).toHaveLength(0);
    });

    it("fails clearly when the user hasn't linked an account", async () => {
      const alice = await seedUser(t.db, "alice");
      adapter.loadAccount.mockResolvedValue(null);

      await expect(library.syncGames(alice)).rejects.toThrow(
        /No steam account linked/,
      );
      expect(adapter.fetchOwnedGames).not.toHaveBeenCalled();
    });
  });

  describe("link", () => {
    it("links the account, syncs the library, and returns the profile and game ids", async () => {
      const alice = await seedUser(t.db, "alice");
      adapter.fetchOwnedGames.mockResolvedValue([
        owned({ externalId: "a", title: "A" }),
        owned({ externalId: "b", title: "B" }),
      ]);
      const lock = { tryAcquire: vi.fn(async () => true), release: vi.fn(async () => {}) };
      const locked = new PlatformLibrary(t.db, adapter as never, lock);

      const result = await locked.link(alice, {});

      expect(result.profile).toEqual({ displayName: "Alice" });
      const catalogIds = (await t.db.select({ id: games.id }).from(games)).map((g) => g.id);
      expect(result.gameIds.sort()).toEqual(catalogIds.sort());
      expect(adapter.link).toHaveBeenCalledWith(t.db, alice, {});
      // Runs under a lock, and always releases it.
      expect(lock.tryAcquire).toHaveBeenCalledTimes(1);
      expect(lock.release).toHaveBeenCalledTimes(1);
    });

    it("doesn't sync the library when linking fails", async () => {
      const alice = await seedUser(t.db, "alice");
      adapter.link.mockRejectedValue(new Error("no such profile"));

      await expect(library.link(alice, {})).rejects.toThrow("no such profile");
      expect(adapter.fetchOwnedGames).not.toHaveBeenCalled();
    });
  });

  describe("syncAchievements", () => {
    it("stores definitions and the user's unlocks, and flags the game as having achievements", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(
          ach("A", true, { globalPercentage: 12.5, points: 10, tier: "gold" }),
          ach("B", false),
        ),
      );

      const result = await library.syncAchievements(alice, gameId!);

      expect(result).toEqual({ synced: 2 });
      const defs = await t.db.select().from(achievements);
      expect(defs).toHaveLength(2);
      expect(defs.find((d) => d.externalKey === "A")).toMatchObject({
        gameId,
        globalPercentage: 12.5,
        points: 10,
        tier: "gold",
      });
      const unlocks = await t.db.select().from(userAchievements);
      expect(unlocks.map((u) => u.achieved).sort()).toEqual([false, true]);
      expect((await t.db.select().from(games))[0]!.hasAchievements).toBe(true);
    });

    it("recomputes the user's completion and status", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(ach("A", true), ach("B", true), ach("C", false)),
      );

      await library.syncAchievements(alice, gameId!);

      expect((await userGameFor(alice, gameId!)).completionPercentage).toBeCloseTo(66.67, 1);
    });

    it("marks the game completed at 100%", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", true), ach("B", true)));

      await library.syncAchievements(alice, gameId!);

      expect(await userGameFor(alice, gameId!)).toMatchObject({
        completionPercentage: 100,
        status: "completed",
      });
    });

    it("marks the game completed when a platinum tier is earned, whatever the percentage", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(ach("P", true, { tier: "platinum" }), ach("B", false), ach("C", false)),
      );

      await library.syncAchievements(alice, gameId!);

      expect((await userGameFor(alice, gameId!)).status).toBe("completed");
    });

    it("does not treat an unearned platinum as completion", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(ach("P", false, { tier: "platinum" }), ach("B", true)),
      );

      await library.syncAchievements(alice, gameId!);

      expect((await userGameFor(alice, gameId!)).status).not.toBe("completed");
    });

    it("is idempotent and picks up newly unlocked achievements", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", false)));
      await library.syncAchievements(alice, gameId!);

      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", true)));
      await library.syncAchievements(alice, gameId!);

      expect(await t.db.select().from(achievements)).toHaveLength(1);
      const unlocks = await t.db.select().from(userAchievements);
      expect(unlocks).toHaveLength(1);
      expect(unlocks[0]!.achieved).toBe(true);
    });

    it("shares definitions between users but keeps each user's unlock state", async () => {
      const alice = await seedUser(t.db, "alice");
      const bob = await seedUser(t.db, "bob");
      const [gameId] = await syncLibrary(alice, [owned()]);
      await syncLibrary(bob, [owned()]);

      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", true), ach("B", false)));
      await library.syncAchievements(alice, gameId!);
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", false), ach("B", false)));
      await library.syncAchievements(bob, gameId!);

      expect(await t.db.select().from(achievements)).toHaveLength(2);
      const forUser = async (userId: string) =>
        (await t.db.select().from(userAchievements).where(eq(userAchievements.userId, userId)))
          .filter((u) => u.achieved).length;
      expect(await forUser(alice)).toBe(1);
      expect(await forUser(bob)).toBe(0);
    });

    it("tolerates the platform repeating a key", async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", false), ach("A", true)));

      await expect(library.syncAchievements(alice, gameId!)).resolves.toEqual({ synced: 1 });
    });

    it("treats an 'ok' with no achievements as empty instead of failing", async () => {
      // e.g. Steam: the game defines achievements but the player's list is empty.
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(ok());

      await expect(library.syncAchievements(alice, gameId!)).resolves.toEqual({
        synced: 0,
      });

      expect((await t.db.select().from(games))[0]!.hasAchievements).toBe(false);
      expect(await t.db.select().from(achievements)).toHaveLength(0);
    });

    it("hands the adapter the game's external id and metadata", async () => {
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", true)));
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [
        owned({ externalId: "NPWR1_00", metadata: { npServiceName: "trophy" } }),
      ]);

      await library.syncAchievements(alice, gameId!);

      expect(adapter.fetchAchievements).toHaveBeenCalledWith(
        { id: "acct" },
        { externalId: "NPWR1_00", metadata: { npServiceName: "trophy" } },
      );
    });

    describe("ownership", () => {
      it("rejects a game that isn't in the user's library", async () => {
        const alice = await seedUser(t.db, "alice");
        const bob = await seedUser(t.db, "bob");
        const [gameId] = await syncLibrary(alice, [owned()]);

        await expect(library.syncAchievements(bob, gameId!)).rejects.toThrow(
          GameNotFoundError,
        );
        expect(adapter.fetchAchievements).not.toHaveBeenCalled();
      });

      it("rejects a game from a different platform than this engine's", async () => {
        const alice = await seedUser(t.db, "alice");
        const [gameId] = await syncLibrary(alice, [owned()]);
        await t.db.update(games).set({ platform: "xbox" }).where(eq(games.id, gameId!));

        await expect(library.syncAchievements(alice, gameId!)).rejects.toThrow(
          GameNotFoundError,
        );
      });

      it("rejects when the user has no account linked", async () => {
        const alice = await seedUser(t.db, "alice");
        const [gameId] = await syncLibrary(alice, [owned()]);
        adapter.loadAccount.mockResolvedValue(null);

        await expect(library.syncAchievements(alice, gameId!)).rejects.toThrow(
          GameNotFoundError,
        );
      });
    });
  });

  describe("syncAllAchievements", () => {
    const manyGames = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        owned({ externalId: `g${i}`, title: `Game ${i}` }),
      );

    it("syncs every game, at most one batch at a time", async () => {
      const alice = await seedUser(t.db, "alice");
      const gameIds = await syncLibrary(alice, manyGames(5));
      let active = 0;
      let maxActive = 0;
      adapter.fetchAchievements.mockImplementation(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active--;
        return ok(ach("A", true));
      });

      await library.syncAllAchievements(alice, gameIds);

      expect(adapter.fetchAchievements).toHaveBeenCalledTimes(5);
      expect(await t.db.select().from(userAchievements)).toHaveLength(5);
      // adapter.batch.size is 2: parallel within a batch, never beyond it.
      expect(maxActive).toBe(2);
    });

    it("carries on when one game fails", async () => {
      const alice = await seedUser(t.db, "alice");
      const gameIds = await syncLibrary(alice, manyGames(3));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      adapter.fetchAchievements.mockImplementation(async (_account, game) => {
        if ((game as { externalId: string }).externalId === "g1") {
          throw new Error("platform down");
        }
        return ok(ach("A", true));
      });

      await library.syncAllAchievements(alice, gameIds);

      expect(await t.db.select().from(userAchievements)).toHaveLength(2);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("does nothing for an empty list", async () => {
      const alice = await seedUser(t.db, "alice");

      await library.syncAllAchievements(alice, []);

      expect(adapter.fetchAchievements).not.toHaveBeenCalled();
    });

    it("syncs the games link() returned, which is the whole point of returning catalog ids", async () => {
      const alice = await seedUser(t.db, "alice");
      adapter.fetchOwnedGames.mockResolvedValue(manyGames(3));
      adapter.fetchAchievements.mockResolvedValue(ok(ach("A", true)));

      const { gameIds } = await library.link(alice, {});
      await library.syncAllAchievements(alice, gameIds);

      expect(adapter.fetchAchievements).toHaveBeenCalledTimes(3);
      expect(await t.db.select().from(userAchievements)).toHaveLength(3);
    });
  });

  describe("getAchievements", () => {
    const setup = async () => {
      const alice = await seedUser(t.db, "alice");
      const [gameId] = await syncLibrary(alice, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(
          ach("A", true, { name: "Zeta", globalPercentage: 10, unlockedAt: new Date("2026-01-01") }),
          ach("B", false, { name: "Alpha", globalPercentage: 50 }),
          ach("C", true, { name: "Mid", globalPercentage: 30, unlockedAt: new Date("2026-02-01") }),
          ach("D", false, { name: "Beta", globalPercentage: 20 }),
          ach("E", true, { name: "Echo", globalPercentage: 40, unlockedAt: new Date("2026-03-01") }),
        ),
      );
      return { alice, gameId: gameId! };
    };
    const names = (page: { data: { name: string }[] }) => page.data.map((a) => a.name);

    it("syncs on the first read only", async () => {
      const { alice, gameId } = await setup();

      await library.getAchievements(alice, gameId);
      await library.getAchievements(alice, gameId);

      expect(adapter.fetchAchievements).toHaveBeenCalledTimes(1);
    });

    it("returns entries that satisfy the shared Achievement schema (the frontend's contract)", async () => {
      const { alice, gameId } = await setup();

      const page = await library.getAchievements(alice, gameId);

      expect(page.data).toHaveLength(5);
      for (const entry of page.data) {
        const parsed = v.safeParse(AchievementSchema, entry);
        expect(parsed.issues?.map((i) => i.message)).toBeUndefined();
        expect(entry.gameId).toBe(gameId);
      }
    });

    it("sorts by rarity (most common first), name, and unlock date", async () => {
      const { alice, gameId } = await setup();

      expect(names(await library.getAchievements(alice, gameId, { sort: "rarity" })))
        .toEqual(["Alpha", "Echo", "Mid", "Beta", "Zeta"]);
      expect(names(await library.getAchievements(alice, gameId, { sort: "name" })))
        .toEqual(["Alpha", "Beta", "Echo", "Mid", "Zeta"]);
      expect(
        names(await library.getAchievements(alice, gameId, { sort: "unlock-date", filter: "unlocked" })),
      ).toEqual(["Echo", "Mid", "Zeta"]);
    });

    it("filters to unlocked or locked, with totals for the filtered set", async () => {
      const { alice, gameId } = await setup();

      const unlocked = await library.getAchievements(alice, gameId, { filter: "unlocked" });
      const locked = await library.getAchievements(alice, gameId, { filter: "locked" });

      expect(names(unlocked).sort()).toEqual(["Echo", "Mid", "Zeta"]);
      expect(unlocked).toMatchObject({ total: 3, unlocked: 3 });
      expect(names(locked).sort()).toEqual(["Alpha", "Beta"]);
      expect(locked).toMatchObject({ total: 2, unlocked: 0 });
    });

    it("pages with a stable order and reports totals for the whole set", async () => {
      const { alice, gameId } = await setup();

      const first = await library.getAchievements(alice, gameId, { sort: "name", limit: 2, offset: 0 });
      const second = await library.getAchievements(alice, gameId, { sort: "name", limit: 2, offset: 2 });
      const last = await library.getAchievements(alice, gameId, { sort: "name", limit: 2, offset: 4 });

      expect(names(first)).toEqual(["Alpha", "Beta"]);
      expect(names(second)).toEqual(["Echo", "Mid"]);
      expect(names(last)).toEqual(["Zeta"]);
      for (const page of [first, second, last]) {
        expect(page).toMatchObject({ total: 5, unlocked: 3 });
      }
    });

    it("shows each user only their own unlock state", async () => {
      const { alice, gameId } = await setup();
      // Alice's first read syncs her unlocks (3 of 5) before the platform's answer changes.
      await library.getAchievements(alice, gameId);
      const bob = await seedUser(t.db, "bob");
      await syncLibrary(bob, [owned()]);
      adapter.fetchAchievements.mockResolvedValue(
        ok(ach("A", false), ach("B", false), ach("C", false), ach("D", false), ach("E", false)),
      );

      await library.getAchievements(alice, gameId);
      const forBob = await library.getAchievements(bob, gameId);

      expect(forBob.unlocked).toBe(0);
      expect((await library.getAchievements(alice, gameId)).unlocked).toBe(3);
    });

    it("rejects a game that isn't in the user's library", async () => {
      const { gameId } = await setup();
      const bob = await seedUser(t.db, "bob");

      await expect(library.getAchievements(bob, gameId)).rejects.toThrow(
        GameNotFoundError,
      );
    });
  });
});
