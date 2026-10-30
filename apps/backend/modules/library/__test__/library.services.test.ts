import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

import { GameNotFoundError, LibraryService } from "../library.services";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import {
  seedAchievements,
  seedCatalogGame,
  seedOwnedGame,
  seedOwnership,
  seedUser,
} from "../../../tests/seed";

// These tests run against a real Postgres (PGlite) on purpose. The rule they
// protect — a user only ever sees their own library — is a WHERE clause, and
// a mocked query builder ignores its WHERE clause.

describe("LibraryService", () => {
  let t: TestDb;
  let service: LibraryService;
  const steamService = { getGameAchievements: vi.fn(), syncGameAchievements: vi.fn() };
  const xboxService = { getGameAchievements: vi.fn(), syncGameAchievements: vi.fn() };
  const psnService = { getGameTrophies: vi.fn(), syncGameTrophies: vi.fn() };

  beforeAll(async () => {
    t = await createTestDb();
    service = new LibraryService(
      t.db,
      {} as never,
      steamService as never,
      xboxService as never,
      psnService as never,
    );
  });

  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    vi.clearAllMocks();
  });

  const titles = (r: { games: { title: string }[] }) =>
    r.games.map((g) => g.title).sort();

  describe("getUserGames", () => {
    describe("isolation between users", () => {
      it("returns only the games the user owns, on every platform", async () => {
        const alice = await seedUser(t.db, "alice");
        const bob = await seedUser(t.db, "bob");
        await seedOwnedGame(t.db, alice, { title: "Alice Steam", platform: "steam" });
        await seedOwnedGame(t.db, alice, { title: "Alice Xbox", platform: "xbox" });
        await seedOwnedGame(t.db, bob, { title: "Bob Steam", platform: "steam" });
        await seedOwnedGame(t.db, bob, { title: "Bob PSN", platform: "playstation" });

        const forAlice = await service.getUserGames(alice);
        const forBob = await service.getUserGames(bob);

        expect(titles(forAlice)).toEqual(["Alice Steam", "Alice Xbox"]);
        expect(forAlice.total).toBe(2);
        expect(titles(forBob)).toEqual(["Bob PSN", "Bob Steam"]);
        expect(forBob.total).toBe(2);
      });

      it("never returns a game that exists in the catalog but isn't theirs", async () => {
        const alice = await seedUser(t.db, "alice");
        const bob = await seedUser(t.db, "bob");
        const { gameId } = await seedOwnedGame(t.db, alice, {
          title: "Alice Only",
          platform: "steam",
        });

        // Even asking for it by id.
        const result = await service.getUserGames(bob, { id: gameId });

        expect(result.games).toEqual([]);
        expect(result.total).toBe(0);
      });

      it("returns nothing for a user with a linked account but no games", async () => {
        const alice = await seedUser(t.db, "alice");
        const bob = await seedUser(t.db, "bob");
        await seedOwnedGame(t.db, alice, { title: "Alice Only", platform: "xbox" });

        expect(await service.getUserGames(bob)).toEqual({ games: [], total: 0 });
      });
    });

    describe("per-user values", () => {
      it("shows each user their own progress for the same catalog game", async () => {
        const alice = await seedUser(t.db, "alice");
        const bob = await seedUser(t.db, "bob");
        const { gameId } = await seedCatalogGame(t.db, {
          title: "Shared Game",
          platform: "steam",
        });
        await seedOwnership(t.db, alice, gameId, {
          status: "completed",
          playTime: 120,
          completionPercentage: 100,
          lastPlayedAt: new Date("2026-03-01T00:00:00Z"),
        });
        await seedOwnership(t.db, bob, gameId, { status: "backlog" });

        const [forAlice] = (await service.getUserGames(alice)).games;
        const [forBob] = (await service.getUserGames(bob)).games;

        expect(forAlice).toMatchObject({
          status: "completed",
          playTime: 120,
          completionPercentage: 100,
          lastPlayedAt: "2026-03-01T00:00:00.000Z",
        });
        expect(forBob).toMatchObject({
          status: "backlog",
          playTime: 0,
          completionPercentage: 0,
          lastPlayedAt: null,
        });
      });
    });

    describe("externalId", () => {
      it("is the platform's own id for each platform", async () => {
        const u = await seedUser(t.db, "alice");
        await seedOwnedGame(t.db, u, { title: "S", platform: "steam", externalId: "570" });
        await seedOwnedGame(t.db, u, { title: "X", platform: "xbox", externalId: "title-9" });
        await seedOwnedGame(t.db, u, { title: "P", platform: "playstation", externalId: "NPWR1_00" });

        const byTitle = Object.fromEntries(
          (await service.getUserGames(u)).games.map((g) => [g.title, g]),
        );

        expect(byTitle.S).toMatchObject({ externalId: "570", platform: "steam" });
        expect(byTitle.X).toMatchObject({ externalId: "title-9", platform: "xbox" });
        expect(byTitle.P).toMatchObject({
          externalId: "NPWR1_00",
          platform: "playstation",
        });
      });
    });

    describe("filters", () => {
      let u: string;
      beforeEach(async () => {
        u = await seedUser(t.db, "alice");
        await seedOwnedGame(t.db, u, { title: "Halo Infinite", platform: "xbox", status: "completed" });
        await seedOwnedGame(t.db, u, { title: "Half-Life 2", platform: "steam", status: "in-progress" });
        await seedOwnedGame(t.db, u, { title: "100% Orange Juice", platform: "steam", status: "backlog" });
        await seedOwnedGame(t.db, u, { title: "Astro Bot", platform: "playstation", status: "backlog" });
      });

      it("by platform", async () => {
        expect(titles(await service.getUserGames(u, { platform: "steam" }))).toEqual([
          "100% Orange Juice",
          "Half-Life 2",
        ]);
      });

      it("by status, using the user's status", async () => {
        expect(titles(await service.getUserGames(u, { status: "backlog" }))).toEqual([
          "100% Orange Juice",
          "Astro Bot",
        ]);
      });

      it("by title: partial and case-insensitive", async () => {
        expect(titles(await service.getUserGames(u, { title: "hal" }))).toEqual([
          "Half-Life 2",
          "Halo Infinite",
        ]);
      });

      it("by title: % and _ are literal, not wildcards", async () => {
        expect(titles(await service.getUserGames(u, { title: "100%" }))).toEqual([
          "100% Orange Juice",
        ]);
        expect(await service.getUserGames(u, { title: "H_lo" })).toEqual({
          games: [],
          total: 0,
        });
      });

      it("by id", async () => {
        const { games } = await service.getUserGames(u, { title: "Astro" });
        const result = await service.getUserGames(u, { id: games[0]!.id });
        expect(titles(result)).toEqual(["Astro Bot"]);
      });

      it("combined", async () => {
        const result = await service.getUserGames(u, {
          platform: "steam",
          status: "backlog",
        });
        expect(titles(result)).toEqual(["100% Orange Juice"]);
      });
    });

    describe("pagination", () => {
      let u: string;
      beforeEach(async () => {
        u = await seedUser(t.db, "alice");
        // updatedAt strictly decreasing with the index: game 0 is newest.
        for (let i = 0; i < 5; i++) {
          await seedOwnedGame(t.db, u, {
            title: `Game ${i}`,
            platform: "steam",
            updatedAt: new Date(Date.UTC(2026, 0, 10 - i)),
          });
        }
      });

      it("orders by most recently updated and reports the full total", async () => {
        const page = await service.getUserGames(u, {}, { limit: 2, offset: 0 });

        expect(page.games.map((g) => g.title)).toEqual(["Game 0", "Game 1"]);
        expect(page.total).toBe(5);
      });

      it("returns the requested window", async () => {
        const page = await service.getUserGames(u, {}, { limit: 2, offset: 2 });

        expect(page.games.map((g) => g.title)).toEqual(["Game 2", "Game 3"]);
        expect(page.total).toBe(5);
      });

      it("keeps the correct total when the offset is past the end", async () => {
        const page = await service.getUserGames(u, {}, { limit: 2, offset: 10 });

        expect(page.games).toEqual([]);
        expect(page.total).toBe(5);
      });

      it("counts only the filtered, owned games in total", async () => {
        const other = await seedUser(t.db, "bob");
        await seedOwnedGame(t.db, other, { title: "Game X", platform: "steam" });

        const page = await service.getUserGames(
          u,
          { title: "Game" },
          { limit: 1, offset: 0 },
        );

        expect(page.total).toBe(5);
      });
    });
  });

  describe("getStats", () => {
    it("counts games, completion and completed per platform for the user", async () => {
      const u = await seedUser(t.db, "alice");
      await seedOwnedGame(t.db, u, { title: "S1", platform: "steam", status: "completed", completionPercentage: 100 });
      await seedOwnedGame(t.db, u, { title: "S2", platform: "steam", status: "in-progress", completionPercentage: 50 });
      await seedOwnedGame(t.db, u, { title: "S3", platform: "steam", status: "backlog", completionPercentage: 0 });
      await seedOwnedGame(t.db, u, { title: "X1", platform: "xbox", status: "completed", completionPercentage: 100 });

      const { breakdown, total } = await service.getStats(u);

      expect(breakdown.steam).toMatchObject({
        games: 3,
        completedGames: 1,
        completionPercentage: 50,
      });
      expect(breakdown.xbox).toMatchObject({
        games: 1,
        completedGames: 1,
        completionPercentage: 100,
      });
      expect(breakdown.playstation).toMatchObject({ games: 0, completedGames: 0 });
      expect(total).toMatchObject({
        games: 4,
        completedGames: 2,
        // (50*3 + 100*1) / 4 = 62.5
        completionPercentage: 62.5,
      });
    });

    it("does not count other users' games or progress", async () => {
      const alice = await seedUser(t.db, "alice");
      const bob = await seedUser(t.db, "bob");
      await seedOwnedGame(t.db, alice, { title: "A", platform: "steam", status: "completed", completionPercentage: 100 });
      await seedOwnedGame(t.db, bob, { title: "B1", platform: "steam" });
      await seedOwnedGame(t.db, bob, { title: "B2", platform: "xbox" });

      const forAlice = await service.getStats(alice);

      expect(forAlice.total.games).toBe(1);
      expect(forAlice.breakdown.steam.games).toBe(1);
      expect(forAlice.breakdown.xbox.games).toBe(0);
      expect(forAlice.total.completedGames).toBe(1);
    });

    it("counts only the user's unlocked achievements, on each platform", async () => {
      const alice = await seedUser(t.db, "alice");
      const bob = await seedUser(t.db, "bob");
      const steam = await seedOwnedGame(t.db, alice, { title: "S", platform: "steam" });
      const xbox = await seedOwnedGame(t.db, alice, { title: "X", platform: "xbox" });
      const psn = await seedOwnedGame(t.db, alice, { title: "P", platform: "playstation" });
      await seedAchievements(t.db, { userId: alice, platform: "steam", externalId: steam.externalId, unlocked: 3, locked: 2 });
      await seedAchievements(t.db, { userId: alice, platform: "xbox", externalId: xbox.externalId, unlocked: 2, locked: 1 });
      await seedAchievements(t.db, { userId: alice, platform: "playstation", externalId: psn.externalId, unlocked: 4 });

      // Bob shares the same catalog games and unlocks more.
      for (const [platform, game] of [["steam", steam], ["xbox", xbox], ["playstation", psn]] as const) {
        await seedOwnership(t.db, bob, game.gameId);
        await seedAchievements(t.db, { userId: bob, platform, externalId: game.externalId, unlocked: 5 });
      }

      const { breakdown, total } = await service.getStats(alice);

      expect(breakdown.steam.achievements).toBe(3);
      expect(breakdown.xbox.achievements).toBe(2);
      expect(breakdown.playstation.achievements).toBe(4);
      expect(total.achievements).toBe(9);
    });

    it("returns zeros for a user with no data", async () => {
      const u = await seedUser(t.db, "alice");

      const { total, breakdown } = await service.getStats(u);

      const zero = { games: 0, completionPercentage: 0, achievements: 0, completedGames: 0 };
      expect(total).toEqual(zero);
      expect(breakdown).toEqual({ steam: zero, xbox: zero, playstation: zero });
    });
  });

  describe("achievement dispatch", () => {
    it("routes an owned game to its platform module", async () => {
      const u = await seedUser(t.db, "alice");
      const steam = await seedOwnedGame(t.db, u, { title: "S", platform: "steam" });
      const psn = await seedOwnedGame(t.db, u, { title: "P", platform: "playstation" });
      steamService.getGameAchievements.mockResolvedValue({ data: [], total: 0, unlocked: 0 });
      psnService.getGameTrophies.mockResolvedValue({ data: [], total: 0, unlocked: 0 });

      await service.getGameAchievements(u, steam.gameId);
      await service.getGameAchievements(u, psn.gameId, { limit: 5 });

      expect(steamService.getGameAchievements).toHaveBeenCalledWith(u, steam.gameId, {});
      expect(psnService.getGameTrophies).toHaveBeenCalledWith(u, psn.gameId, { limit: 5 });
      expect(xboxService.getGameAchievements).not.toHaveBeenCalled();
    });

    it("treats a catalog game the user doesn't own as not found", async () => {
      const alice = await seedUser(t.db, "alice");
      const bob = await seedUser(t.db, "bob");
      const { gameId } = await seedOwnedGame(t.db, alice, { title: "S", platform: "steam" });

      await expect(service.getGameAchievements(bob, gameId)).rejects.toThrow(
        GameNotFoundError,
      );
      await expect(service.syncGameAchievements(bob, gameId)).rejects.toThrow(
        GameNotFoundError,
      );
      expect(steamService.getGameAchievements).not.toHaveBeenCalled();
      expect(steamService.syncGameAchievements).not.toHaveBeenCalled();
    });

    it("treats an unknown game id as not found", async () => {
      const u = await seedUser(t.db, "alice");

      await expect(
        service.getGameAchievements(u, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(GameNotFoundError);
    });
  });
});
