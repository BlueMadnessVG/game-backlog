import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPsnController } from "../psn.controller";
import { withAuth } from "../../../tests/auth.helpers";

declare global {
  interface Response {
    json<T = any>(): Promise<T>;
  }
}

const makeMockService = () => ({
  getUserGames: vi.fn(),
  getUserGame: vi.fn(),
  syncUserProfile: vi.fn(),
  syncUserGames: vi.fn(),
  syncAllGameTrophies: vi.fn().mockResolvedValue(undefined),
  syncGameTrophies: vi.fn(),
  getGameTrophies: vi.fn(),
});

const makeMockLibraryService = () => ({
  enrichGameCovers: vi.fn().mockResolvedValue({ enriched: 0 }),
});

const makeGame = (overrides = {}) => ({
  id: "game-1",
  externalId: "NPWR20188_00",
  title: "Astro's Playroom",
  platform: "playstation",
  status: "in-progress",
  iconUrl: "https://example.com/astro.png",
  coverUrl: "https://example.com/astro.png",
  bannerUrl: "https://example.com/astro.png",
  playTime: 0,
  completionPercentage: 75,
  lastPlayedAt: null,
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("PsnController", () => {
  let service: ReturnType<typeof makeMockService>;
  let app: ReturnType<typeof createPsnController>;

  beforeEach(async () => {
    service = makeMockService();
    const libraryService = makeMockLibraryService();
    app = await withAuth(
      createPsnController(service as never, libraryService as never),
    );
  });

  // ── GET /games ────────────────────────────────────────────────────────────

  describe("GET /games", () => {
    it("returns 200 with paginated library", async () => {
      service.getUserGames.mockResolvedValue([makeGame(), makeGame()]);

      const res = await app.request("/games");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });

    it("returns empty library", async () => {
      service.getUserGames.mockResolvedValue([]);

      const res = await app.request("/games");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it("respects limit and offset", async () => {
      const games = Array.from({ length: 10 }, makeGame);
      service.getUserGames.mockResolvedValue(games);

      const res = await app.request("/games?limit=3&offset=2");
      const body = await res.json();

      expect(body.data).toHaveLength(3);
      expect(body.meta.limit).toBe(3);
      expect(body.meta.offset).toBe(2);
    });

    it("returns platform as playstation", async () => {
      service.getUserGames.mockResolvedValue([makeGame()]);

      const res = await app.request("/games");
      const body = await res.json();

      expect(body.data[0].platform).toBe("playstation");
    });
  });

  // ── GET /games/:id ────────────────────────────────────────────────────────

  describe("GET /games/:id", () => {
    it("returns 200 with game", async () => {
      service.getUserGame.mockResolvedValue(makeGame());

      const res = await app.request("/games/game-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.externalId).toBe("NPWR20188_00");
    });

    it("returns 404 when game not found", async () => {
      service.getUserGame.mockResolvedValue(null);

      const res = await app.request("/games/nonexistent");
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.status).toBe("NOT_FOUND");
    });
  });

  // ── POST /sync ────────────────────────────────────────────────────────────

  describe("POST /sync", () => {
    it("returns 200 with profile and game count", async () => {
      service.syncUserProfile.mockResolvedValue({
        accountId: "123",
        onlineId: "BlueMadness",
        avatarUrl: null,
        tokens: {
          accessToken: "tok",
          refreshToken: "ref",
          accessTokenExpiresAt: 0,
        },
      });
      service.syncUserGames.mockResolvedValue([makeGame(), makeGame()]);
      service.syncAllGameTrophies.mockResolvedValue(undefined);

      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsso: "valid-npsso-token-64-chars-padded-to-meet-min",
          onlineId: "BlueMadness",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.gamesCount).toBe(2);
      expect(body.data.profile.onlineId).toBe("BlueMadness");
    });

    it("returns 400 when npsso is missing", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlineId: "BlueMadness" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when onlineId is missing", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npsso: "valid-npsso-token" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when npsso is empty string", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npsso: "", onlineId: "BlueMadness" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when onlineId is too short", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npsso: "valid-npsso", onlineId: "ab" }),
      });

      expect(res.status).toBe(400);
    });

    it("fires trophy sync in background without blocking response", async () => {
      service.syncUserProfile.mockResolvedValue({
        accountId: "123",
        onlineId: "BlueMadness",
        avatarUrl: null,
        tokens: {
          accessToken: "tok",
          refreshToken: "ref",
          accessTokenExpiresAt: 0,
        },
      });
      service.syncUserGames.mockResolvedValue([makeGame()]);

      // Simulate slow background sync
      let resolved = false;
      service.syncAllGameTrophies.mockImplementation(
        () =>
          new Promise((res) =>
            setTimeout(() => {
              resolved = true;
              res(undefined);
            }, 5000),
          ),
      );

      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsso: "valid-npsso-token",
          onlineId: "BlueMadness",
        }),
      });

      // Response should come back immediately — background sync still pending
      expect(res.status).toBe(200);
      expect(resolved).toBe(false);
    });
  });

  // ── POST /games/:gameId/sync-trophies ─────────────────────────────────────

  describe("POST /games/:gameId/sync-trophies", () => {
    it("returns 200 on successful sync", async () => {
      service.syncGameTrophies.mockResolvedValue([]);

      const res = await app.request("/games/game-1/sync-trophies", {
        method: "POST",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
    });

    it("passes gameId from route param to service", async () => {
      service.syncGameTrophies.mockResolvedValue([]);

      await app.request("/games/specific-game-id/sync-trophies", {
        method: "POST",
      });

      expect(service.syncGameTrophies).toHaveBeenCalledWith(
        expect.any(String),
        "specific-game-id",
      );
    });
  });

  // ── POST /games/:gameId/trophies ──────────────────────────────────────────

  describe("POST /games/:gameId/trophies", () => {
    it("returns 200 with trophy data", async () => {
      service.getGameTrophies.mockResolvedValue({
        data: [],
        total: 25,
        unlocked: 10,
      });

      const res = await app.request("/games/game-1/trophies", {
        method: "POST",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.meta.total).toBe(25);
      expect(body.meta.unlocked).toBe(10);
    });

    it("returns 400 for invalid filter value", async () => {
      const res = await app.request("/games/game-1/trophies?filter=invalid", {
        method: "POST",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid sort value", async () => {
      const res = await app.request("/games/game-1/trophies?sort=badvalue", {
        method: "POST",
      });
      expect(res.status).toBe(400);
    });

    it("passes filter and sort to service", async () => {
      service.getGameTrophies.mockResolvedValue({
        data: [],
        total: 0,
        unlocked: 0,
      });

      await app.request("/games/game-1/trophies?filter=unlocked&sort=name", {
        method: "POST",
      });

      expect(service.getGameTrophies).toHaveBeenCalledWith(
        expect.any(String),
        "game-1",
        expect.objectContaining({ filter: "unlocked", sort: "name" }),
      );
    });

    it("caps limit at 100", async () => {
      service.getGameTrophies.mockResolvedValue({
        data: [],
        total: 0,
        unlocked: 0,
      });

      await app.request("/games/game-1/trophies?limit=999", { method: "POST" });

      expect(service.getGameTrophies).toHaveBeenCalledWith(
        expect.any(String),
        "game-1",
        expect.objectContaining({ limit: 100 }),
      );
    });
  });
});
