import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { and, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import {
  games,
  psnGames,
  psnUserTrophies,
  userAchievements,
  userGames,
} from "../../../db/schema";
import type { DbClient } from "../../../db";
import type { AdvisoryLockClient } from "../../../lib/locks";
import { LibraryService } from "../library.services";
import { PlatformLibrary } from "../../platforms/platform-library";
import { SteamAdapter } from "../../platforms/steam.adapter";
import { XboxAdapter } from "../../platforms/xbox.adapter";
import { PsnService } from "../../psn/psn.services";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import {
  seedAchievements,
  seedOwnedGame,
  seedOwnership,
  seedUser,
  type Platform,
} from "../../../tests/seed";

// The rule under test: what one user's sync learns about a GAME must never
// delete anything the other users own. These run against a real database
// because the failure is a cascade of foreign keys, which no mock reproduces.

type Outcome = "ok" | "empty" | "error";

/** Everything platform-specific, so the scenarios below are written once. */
type PlatformCase = {
  platform: Platform;
  /** Builds the platform module over `db` with a stub provider. */
  setup(db: DbClient, lock: AdvisoryLockClient): {
    /** Makes the provider's achievement lookup answer with `outcome`. */
    respond(outcome: Outcome): void;
    /** How many times the provider's achievement lookup was called. */
    lookups(): number;
    syncGame(userId: string, gameId: string): Promise<unknown>;
    syncAll(userId: string, gameIds: string[]): Promise<unknown>;
    /** The platform module's own library list. */
    listOwn(userId: string): Promise<{ id: string }[]>;
  };
  /** How many rows tie the game to its platform id (the catalog row itself, for Steam). */
  mappingRows(db: DbClient, gameId: string): Promise<number>;
  countUnlocked(db: DbClient, userId: string): Promise<number>;
};

const count = async (db: DbClient, table: PgTable, where?: SQL) => {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return row!.n;
};

const cases: PlatformCase[] = [
  {
    platform: "steam",
    mappingRows: (db, gameId) =>
      count(db, games, and(eq(games.id, gameId), isNotNull(games.externalId))),
    countUnlocked: (db, userId) =>
      count(db, userAchievements, eq(userAchievements.userId, userId)),
    setup(db, lock) {
      const provider = {
        getPlayerAchievements: vi.fn(),
        getGameSchema: vi.fn(),
      };
      const service = new PlatformLibrary(db, new SteamAdapter(provider as never), lock);
      const reads = new LibraryService(db, {} as never, {} as never);
      return {
        respond(outcome) {
          provider.getPlayerAchievements.mockResolvedValue([
            { apiName: "ACH_0", achieved: true, unlockedAt: null, name: "ACH_0", description: null },
          ]);
          provider.getGameSchema.mockResolvedValue(
            outcome === "ok"
              ? {
                  status: "ok",
                  schema: new Map([
                    ["ACH_0", { displayName: "A0", description: null, hidden: false, iconUrl: "u", iconGrayUrl: "g", globalPercentage: 5 }],
                  ]),
                }
              : { status: outcome },
          );
        },
        lookups: () => provider.getGameSchema.mock.calls.length,
        syncGame: (u, g) => service.syncAchievements(u, g),
        syncAll: (u, ids) => service.syncAllAchievements(u, ids),
        listOwn: async (u) =>
          (await reads.getUserGames(u, { platform: "steam" })).games,
      };
    },
  },
  {
    platform: "xbox",
    mappingRows: (db, gameId) =>
      count(db, games, and(eq(games.id, gameId), isNotNull(games.externalId))),
    countUnlocked: (db, userId) =>
      count(db, userAchievements, eq(userAchievements.userId, userId)),
    setup(db, lock) {
      const provider = { getPlayerAchievements: vi.fn() };
      const service = new PlatformLibrary(db, new XboxAdapter(provider as never), lock);
      const reads = new LibraryService(db, {} as never, {} as never);
      return {
        respond(outcome) {
          provider.getPlayerAchievements.mockResolvedValue(
            outcome === "ok"
              ? {
                  status: "ok",
                  achievements: [
                    { apiName: "ACH_0", name: "A0", description: null, isSecret: false, iconUrl: null, gamerscore: 10, globalPercentage: 5, achieved: true, unlockedAt: null },
                  ],
                }
              : { status: outcome },
          );
        },
        lookups: () => provider.getPlayerAchievements.mock.calls.length,
        syncGame: (u, g) => service.syncAchievements(u, g),
        syncAll: (u, ids) => service.syncAllAchievements(u, ids),
        listOwn: async (u) =>
          (await reads.getUserGames(u, { platform: "xbox" })).games,
      };
    },
  },
  {
    platform: "playstation",
    mappingRows: (db, gameId) =>
      count(db, psnGames, eq(psnGames.gameId, gameId)),
    countUnlocked: (db, userId) =>
      count(db, psnUserTrophies, eq(psnUserTrophies.userId, userId)),
    setup(db, lock) {
      const provider = { getGameTrophies: vi.fn(), refreshTokens: vi.fn() };
      const service = new PsnService(db, provider as never, lock);
      return {
        respond(outcome) {
          provider.getGameTrophies.mockResolvedValue(
            outcome === "ok"
              ? {
                  status: "ok",
                  trophies: [
                    { trophyId: "0", name: "T0", detail: null, trophyType: "bronze", trophyHidden: false, trophyIconUrl: null, trophyEarnedRate: 5, earned: true, earnedDateTime: null },
                  ],
                }
              : { status: outcome },
          );
        },
        lookups: () => provider.getGameTrophies.mock.calls.length,
        syncGame: (u, g) => service.syncGameTrophies(u, g),
        syncAll: (u, ids) => service.syncAllGameTrophies(u, ids),
        listOwn: (u) => service.getUserGames(u),
      };
    },
  },
];

const noopLock: AdvisoryLockClient = {
  tryAcquire: async () => true,
  release: async () => undefined,
};

describe.each(cases)("catalog integrity: $platform", (c) => {
  let t: TestDb;
  let library: LibraryService;

  beforeAll(async () => {
    t = await createTestDb();
    library = new LibraryService(t.db, {} as never, {} as never);
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  /** Alice and Bob both own the same catalog game; Bob has unlocked things. */
  const sharedGame = async () => {
    const alice = await seedUser(t.db, "alice");
    const bob = await seedUser(t.db, "bob");
    const game = await seedOwnedGame(t.db, alice, {
      title: "Shared",
      platform: c.platform,
      status: "in-progress",
      playTime: 30,
    });
    // Bob owns the SAME catalog row, with his own progress.
    await seedOwnership(t.db, bob, game.gameId, {
      status: "completed",
      playTime: 500,
      completionPercentage: 100,
    });
    await seedAchievements(t.db, {
      userId: bob,
      platform: c.platform,
      gameId: game.gameId,
      externalId: game.externalId,
      unlocked: 2,
    });
    return { alice, bob, ...game };
  };

  const flag = async (gameId: string) => {
    const [row] = await t.db
      .select({ v: games.hasAchievements })
      .from(games)
      .where(eq(games.id, gameId));
    return row?.v;
  };

  it("an 'empty' answer to one user's sync deletes nothing for anyone", async () => {
    const { alice, bob, gameId } = await sharedGame();
    const platform = c.setup(t.db, noopLock);
    platform.respond("empty");

    await platform.syncGame(alice, gameId);

    // The catalog row, its platform mapping and BOTH users' ownership survive...
    expect(await count(t.db, games, eq(games.id, gameId))).toBe(1);
    expect(await c.mappingRows(t.db, gameId)).toBe(1);
    expect(await count(t.db, userGames, eq(userGames.gameId, gameId))).toBe(2);
    // ...including Bob's progress and unlocked achievements.
    const bobsGame = (await t.db.select().from(userGames).where(eq(userGames.userId, bob)))[0]!;
    expect(bobsGame).toMatchObject({ status: "completed", playTime: 500, completionPercentage: 100 });
    expect(await c.countUnlocked(t.db, bob)).toBe(2);
    // The game is only marked.
    expect(await flag(gameId)).toBe(false);
  });

  it("a game with no achievements is hidden from every library read, for every user", async () => {
    const { alice, bob, gameId } = await sharedGame();
    const platform = c.setup(t.db, noopLock);
    platform.respond("empty");

    await platform.syncGame(alice, gameId);

    for (const user of [alice, bob]) {
      expect((await library.getUserGames(user)).games).toEqual([]);
      expect((await library.getUserGames(user)).total).toBe(0);
      expect((await library.getStats(user)).total.games).toBe(0);
      expect(await platform.listOwn(user)).toEqual([]);
    }
  });

  it("a failed lookup is not 'no achievements': nothing changes and the game stays visible", async () => {
    const { alice, gameId } = await sharedGame();
    const platform = c.setup(t.db, noopLock);
    platform.respond("error");

    await platform.syncGame(alice, gameId);

    expect(await flag(gameId)).toBeNull();
    expect(await count(t.db, userGames, eq(userGames.gameId, gameId))).toBe(2);
    expect((await library.getUserGames(alice)).total).toBe(1);
  });

  it("a later successful sync brings a hidden game back", async () => {
    const { alice, gameId } = await sharedGame();
    const platform = c.setup(t.db, noopLock);

    platform.respond("empty");
    await platform.syncGame(alice, gameId);
    expect(await flag(gameId)).toBe(false);
    expect((await library.getUserGames(alice)).total).toBe(0);

    platform.respond("ok");
    await platform.syncGame(alice, gameId);

    expect(await flag(gameId)).toBe(true);
    expect((await library.getUserGames(alice)).total).toBe(1);
  });

  it("the batch sync skips games already known to have none, without calling the platform", async () => {
    const alice = await seedUser(t.db, "alice");
    const known = await seedOwnedGame(t.db, alice, { title: "Known None", platform: c.platform });
    const fresh = await seedOwnedGame(t.db, alice, { title: "Not Checked", platform: c.platform });
    await t.db.update(games).set({ hasAchievements: false }).where(eq(games.id, known.gameId));
    const platform = c.setup(t.db, noopLock);
    platform.respond("ok");

    await platform.syncAll(alice, [known.gameId, fresh.gameId]);

    expect(platform.lookups()).toBe(1);
    expect(await flag(fresh.gameId)).toBe(true);
    expect(await flag(known.gameId)).toBe(false);
  });
});

// Two owned games with the same title on one platform (PSN: the PS4 and PS5
// versions of a game; Steam: two apps sharing a name). The catalog is keyed
// by (title, platform), and Postgres rejects an upsert that hits the same key
// twice in one statement — which used to fail the user's whole library sync.
describe("library sync: two owned games with the same title", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const progressOf = async (userId: string) =>
    t.db
      .select({
        title: games.title,
        playTime: userGames.playTime,
        completionPercentage: userGames.completionPercentage,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .where(eq(userGames.userId, userId));

  it("steam: syncs, keeping the version with the most play time", async () => {
    const alice = await seedUser(t.db, "alice");
    const app = (steamAppId: string, playtimeMinutes: number) => ({
      steamAppId,
      name: "Doom",
      playtimeMinutes,
      iconUrl: null,
      coverUrl: null,
      lastPlayedAt: null,
    });
    const service = new PlatformLibrary(
      t.db,
      new SteamAdapter({
        getOwnedGames: async () => [app("2280", 30), app("379720", 900)],
      } as never),
      noopLock,
    );

    await service.syncGames(alice);

    expect(await progressOf(alice)).toEqual([
      { title: "Doom", playTime: 900, completionPercentage: 0 },
    ]);
    const [kept] = await t.db.select().from(games);
    expect(kept?.externalId).toBe("379720");
  });

  it("psn: syncs, keeping the version with the most progress", async () => {
    const alice = await seedUser(t.db, "alice");
    const version = (npCommunicationId: string, platform: string, completionPercentage: number) => ({
      npCommunicationId,
      name: "Ghost of Tsushima",
      iconUrl: null,
      trophyTitlePlatform: platform,
      npServiceName: platform === "PS5" ? ("trophy2" as const) : ("trophy" as const),
      completionPercentage,
      platinumEarned: false,
      lastUpdatedDateTime: null,
    });
    const service = new PsnService(
      t.db,
      {
        getOwnedGames: async () => [
          version("NPWR_PS4", "PS4", 15),
          version("NPWR_PS5", "PS5", 60),
        ],
      } as never,
      noopLock,
    );

    await service.syncUserGames(alice);

    expect(await progressOf(alice)).toEqual([
      { title: "Ghost of Tsushima", playTime: 0, completionPercentage: 60 },
    ]);
    const [mapping] = await t.db.select().from(psnGames);
    expect(mapping?.npCommunicationId).toBe("NPWR_PS5");
  });

  it("xbox: syncs, keeping the most recently played version", async () => {
    const alice = await seedUser(t.db, "alice");
    const title = (titleId: string, lastPlayedAt: Date) => ({
      titleId,
      name: "Forza Horizon 5",
      coverUrl: null,
      lastPlayedAt,
      completionPercentage: 20,
    });
    const service = new PlatformLibrary(
      t.db,
      new XboxAdapter({
        getOwnedGames: async () => [
          title("old-id", new Date("2025-01-01")),
          title("new-id", new Date("2026-01-01")),
        ],
        getPlaytimeMinutes: async () => new Map([["new-id", 45]]),
      } as never),
      noopLock,
    );

    await service.syncGames(alice);

    expect(await progressOf(alice)).toEqual([
      { title: "Forza Horizon 5", playTime: 45, completionPercentage: 20 },
    ]);
  });
});
