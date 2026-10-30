import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import {
  games,
  psnGames,
  psnUserTrophies,
  steamGames,
  userAchievements,
  userGames,
  xboxGames,
  xboxUserAchievements,
} from "../../../db/schema";
import type { DbClient } from "../../../db";
import type { AdvisoryLockClient } from "../../../lib/locks";
import { LibraryService } from "../library.services";
import { SteamService } from "../../steam/steam.services";
import { XboxService } from "../../xbox/xbox.services";
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
  mappingTable: typeof steamGames | typeof xboxGames | typeof psnGames;
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
    mappingTable: steamGames,
    countUnlocked: (db, userId) =>
      count(db, userAchievements, eq(userAchievements.userId, userId)),
    setup(db, lock) {
      const provider = {
        getPlayerAchievements: vi.fn(),
        getGameSchema: vi.fn(),
      };
      const service = new SteamService(db, provider as never, lock);
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
        syncGame: (u, g) => service.syncGameAchievements(u, g),
        syncAll: (u, ids) => service.syncAllGameAchievements(u, ids),
        listOwn: (u) => service.getUserGames(u),
      };
    },
  },
  {
    platform: "xbox",
    mappingTable: xboxGames,
    countUnlocked: (db, userId) =>
      count(db, xboxUserAchievements, eq(xboxUserAchievements.userId, userId)),
    setup(db, lock) {
      const provider = { getPlayerAchievements: vi.fn() };
      const service = new XboxService(db, provider as never, lock);
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
        syncGame: (u, g) => service.syncGameAchievements(u, g),
        syncAll: (u, ids) => service.syncAllGameAchievements(u, ids),
        listOwn: (u) => service.getUserGames(u),
      };
    },
  },
  {
    platform: "playstation",
    mappingTable: psnGames,
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
    library = new LibraryService(t.db, {} as never, {} as never, {} as never, {} as never);
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
    expect(await count(t.db, c.mappingTable, eq(c.mappingTable.gameId, gameId))).toBe(1);
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
