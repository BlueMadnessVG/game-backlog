import { describe, it, expect, vi, beforeEach } from "vitest";
import * as v from "valibot";

import { createPlatformController } from "../platform.controller";
import { GameNotFoundError } from "../errors";
import { withAuth, TEST_USER_ID } from "../../../tests/auth.helpers";

// The controller is the same for every platform. These tests pin the HTTP
// contract the frontend depends on (paths, response shapes), using a fake
// PlatformLibrary and LibraryService.

const makeLibrary = (enrichCovers = false) => ({
  platform: "steam" as const,
  adapter: {
    enrichCovers,
    linkSchema: v.object({ steamId: v.pipe(v.string(), v.length(17)) }),
  },
  link: vi.fn(),
  syncAllAchievements: vi.fn(async (..._args: unknown[]) => undefined),
  syncAchievements: vi.fn(),
  getAchievements: vi.fn(),
});

const makeLibraryService = () => ({
  getUserGames: vi.fn(),
  enrichGameCovers: vi.fn(async () => ({ enriched: 0, alreadyEnriched: 0, noMatch: 0 })),
});

const STEAM_ID = "76561198012345678";
const JSON_HEADERS = { "Content-Type": "application/json" };

describe("createPlatformController", () => {
  let library: ReturnType<typeof makeLibrary>;
  let libraryService: ReturnType<typeof makeLibraryService>;
  let app: Awaited<ReturnType<typeof build>>;

  const build = async (lib = library) =>
    withAuth(
      createPlatformController({
        library: lib as never,
        libraryService: libraryService as never,
        authService: { verifyApiToken: vi.fn() } as never,
      }),
    );

  beforeEach(async () => {
    library = makeLibrary();
    libraryService = makeLibraryService();
    libraryService.getUserGames.mockResolvedValue({ games: [{ id: "g1" }], total: 42 });
    app = await build();
  });

  it("requires authentication", async () => {
    const anonymous = createPlatformController({
      library: library as never,
      libraryService: libraryService as never,
      authService: { verifyApiToken: vi.fn() } as never,
    });

    expect((await anonymous.request("/games")).status).toBe(401);
    expect(libraryService.getUserGames).not.toHaveBeenCalled();
  });

  describe("GET /games", () => {
    it("returns this platform's page for the user, with the total", async () => {
      const res = await app.request("/games?limit=10&offset=20");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({
        status: "SUCCESS",
        meta: { total: 42, limit: 10, offset: 20 },
        data: [{ id: "g1" }],
      });
      expect(libraryService.getUserGames).toHaveBeenCalledWith(
        TEST_USER_ID,
        { platform: "steam" },
        { limit: 10, offset: 20 },
      );
    });

    it("defaults to the first 50, caps limit at 100 and clamps a negative offset", async () => {
      await app.request("/games");
      await app.request("/games?limit=100000&offset=-5");

      expect(libraryService.getUserGames).toHaveBeenNthCalledWith(
        1, TEST_USER_ID, { platform: "steam" }, { limit: 50, offset: 0 },
      );
      expect(libraryService.getUserGames).toHaveBeenNthCalledWith(
        2, TEST_USER_ID, { platform: "steam" }, { limit: 100, offset: 0 },
      );
    });
  });

  describe("GET /games/:id", () => {
    it("returns the game", async () => {
      libraryService.getUserGames.mockResolvedValue({ games: [{ id: "g1", title: "Doom" }], total: 1 });

      const res = await app.request("/games/g1");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "SUCCESS", data: { id: "g1", title: "Doom" } });
      expect(libraryService.getUserGames).toHaveBeenCalledWith(
        TEST_USER_ID, { id: "g1", platform: "steam" }, { limit: 1, offset: 0 },
      );
    });

    it("returns 404 when the game isn't in this user's library on this platform", async () => {
      libraryService.getUserGames.mockResolvedValue({ games: [], total: 0 });

      const res = await app.request("/games/nope");

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ status: "NOT_FOUND" });
    });
  });

  describe("POST /sync", () => {
    const sync = (body: unknown) =>
      app.request("/sync", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

    beforeEach(() => {
      library.link.mockResolvedValue({ profile: { displayName: "Alice" }, gameIds: ["g1", "g2", "g3"] });
    });

    it("links the account and returns the profile and game count", async () => {
      const res = await sync({ steamId: STEAM_ID });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({
        status: "SUCCESS",
        message: expect.any(String),
        data: { profile: { displayName: "Alice" }, gamesCount: 3 },
      });
      expect(library.link).toHaveBeenCalledWith(TEST_USER_ID, { steamId: STEAM_ID });
    });

    it("syncs achievements in the background for the CATALOG ids link() returned", async () => {
      // Regression: the old controllers passed user_games row ids here, so
      // the background sync never found a game.
      await sync({ steamId: STEAM_ID });

      expect(library.syncAllAchievements).toHaveBeenCalledWith(TEST_USER_ID, ["g1", "g2", "g3"]);
    });

    it("rejects a body the platform's link schema doesn't accept, before doing anything", async () => {
      const res = await sync({ steamId: "too-short" });

      expect(res.status).toBe(400);
      expect(library.link).not.toHaveBeenCalled();
    });

    it("still succeeds when the background achievement sync fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      library.syncAllAchievements.mockRejectedValue(new Error("platform down"));

      const res = await sync({ steamId: STEAM_ID });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(res.status).toBe(200);
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it("enriches covers only for platforms that need it", async () => {
      await sync({ steamId: STEAM_ID });
      expect(libraryService.enrichGameCovers).not.toHaveBeenCalled();

      const needy = makeLibrary(true);
      needy.link.mockResolvedValue({ profile: {}, gameIds: ["g1"] });
      const needyApp = await build(needy);
      await needyApp.request("/sync", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ steamId: STEAM_ID }),
      });

      expect(libraryService.enrichGameCovers).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("propagates a link failure as an error response and starts no background work", async () => {
      library.link.mockRejectedValue(new Error("no such profile"));

      const res = await sync({ steamId: STEAM_ID });

      expect(res.status).toBe(500);
      expect(library.syncAllAchievements).not.toHaveBeenCalled();
    });
  });

  describe("POST /games/:gameId/sync-achievements", () => {
    it("syncs the game", async () => {
      library.syncAchievements.mockResolvedValue({ synced: 3 });

      const res = await app.request("/games/g1/sync-achievements", { method: "POST" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "SUCCESS", message: "Achievements synced" });
      expect(library.syncAchievements).toHaveBeenCalledWith(TEST_USER_ID, "g1");
    });

    it("returns 404, not 500, for a game that isn't theirs", async () => {
      library.syncAchievements.mockRejectedValue(new GameNotFoundError("g1"));

      const res = await app.request("/games/g1/sync-achievements", { method: "POST" });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ status: "ERROR" });
    });
  });

  describe("POST /games/:gameId/achievements", () => {
    beforeEach(() => {
      library.getAchievements.mockResolvedValue({ data: [{ id: "a1" }], total: 7, unlocked: 3 });
    });
    const read = (query = "") => app.request(`/games/g1/achievements${query}`, { method: "POST" });

    it("returns the page with totals", async () => {
      const res = await read("?limit=5&offset=10");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: "SUCCESS",
        meta: { total: 7, unlocked: 3, limit: 5, offset: 10 },
        data: [{ id: "a1" }],
      });
    });

    it("passes the parsed filter, sort and paging, defaulting to all / rarity / 50", async () => {
      await read();
      await read("?filter=unlocked&sort=name&limit=1000");

      expect(library.getAchievements).toHaveBeenNthCalledWith(1, TEST_USER_ID, "g1", {
        filter: "all", sort: "rarity", limit: 50, offset: 0,
      });
      expect(library.getAchievements).toHaveBeenNthCalledWith(2, TEST_USER_ID, "g1", {
        filter: "unlocked", sort: "name", limit: 100, offset: 0,
      });
    });

    it.each(["?filter=bogus", "?sort=bogus"])("returns 400 for %s without querying", async (query) => {
      const res = await read(query);

      expect(res.status).toBe(400);
      expect(library.getAchievements).not.toHaveBeenCalled();
    });

    it("returns 404 for a game that isn't theirs", async () => {
      library.getAchievements.mockRejectedValue(new GameNotFoundError("g1"));

      expect((await read()).status).toBe(404);
    });
  });
});
