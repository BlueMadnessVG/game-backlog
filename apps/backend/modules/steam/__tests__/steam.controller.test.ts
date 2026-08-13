import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSteamController } from "../steam.controller";
import { withAuth } from "../../../tests/auth.helpers";

const makeMockService = () => ({
  getUserGames: vi.fn(),
  getUserGame: vi.fn(),
  syncUserProfile: vi.fn(),
  syncUserGames: vi.fn(),
  syncAllGameAchievements: vi.fn(),
  syncGameAchievements: vi.fn(),
  getGameAchievements: vi.fn(),
});

const makeGame = () => ({
  id: "game-1",
  externalId: "123",
  title: "Halo",
  platform: "steam",
  status: "backlog",
  iconUrl: null,
  coverUrl: null,
  bannerUrl: null,
  playTime: 0,
  completionPercentage: 0,
  lastPlayedAt: null,
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const parseResponseBody = async <T = any>(res: Response) =>
  (await res.json()) as T;

describe("SteamController", () => {
  let service: ReturnType<typeof makeMockService>;
  let app: ReturnType<typeof createSteamController>;

  beforeEach(async () => {
    service = makeMockService();
    app = await withAuth(createSteamController(service as never));
  });

  // ── GET /games ────────────────────────────────────────────────────────────

  describe("GET /games", () => {
    it("returns 200 with paginated library", async () => {
      service.getUserGames.mockResolvedValue([makeGame(), makeGame()]);

      const res = await app.request("/games");
      const body = await parseResponseBody(res);

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });

    it("returns empty data array when library is empty", async () => {
      service.getUserGames.mockResolvedValue([]);

      const res = await app.request("/games");
      const body = await parseResponseBody(res);

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it("respects limit and offset query params", async () => {
      const games = Array.from({ length: 10 }, makeGame);
      service.getUserGames.mockResolvedValue(games);

      const res = await app.request("/games?limit=3&offset=2");
      const body = await parseResponseBody(res);

      expect(body.data).toHaveLength(3);
      expect(body.meta.limit).toBe(3);
      expect(body.meta.offset).toBe(2);
    });
  });

  // ── GET /games/:id ────────────────────────────────────────────────────────

  describe("GET /games/:id", () => {
    it("returns 200 with game", async () => {
      service.getUserGame.mockResolvedValue(makeGame());

      const res = await app.request("/games/game-1");
      const body = await parseResponseBody(res);

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.id).toBe("game-1");
    });

    it("returns 404 when game not found", async () => {
      service.getUserGame.mockResolvedValue(null);

      const res = await app.request("/games/nonexistent");
      const body = await parseResponseBody(res);

      expect(res.status).toBe(404);
      expect(body.status).toBe("NOT_FOUND");
    });
  });

  // ── POST /sync ────────────────────────────────────────────────────────────

  describe("POST /sync", () => {
    it("returns 200 and fires achievement sync in background", async () => {
      service.syncUserProfile.mockResolvedValue({
        steamId: "123",
        displayName: "User",
      });
      service.syncUserGames.mockResolvedValue([makeGame()]);
      service.syncAllGameAchievements.mockResolvedValue(undefined);

      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: "76561198000000000" }),
      });
      const body = await parseResponseBody(res);

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.gamesCount).toBe(1);
    });

    it("returns 400 for invalid body", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: "short" }), // less than 17 chars
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is missing steamId", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /games/:gameId/achievements ──────────────────────────────────────

  describe("POST /games/:gameId/achievements", () => {
    it("returns 200 with achievement data", async () => {
      service.getGameAchievements.mockResolvedValue({
        data: [],
        total: 0,
        unlocked: 0,
      });

      const res = await app.request("/games/game-1/achievements", {
        method: "POST",
      });
      const body = await parseResponseBody(res);

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.meta.total).toBe(0);
    });

    it("returns 400 for invalid filter value", async () => {
      const res = await app.request(
        "/games/game-1/achievements?filter=invalid",
        { method: "POST" },
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid sort value", async () => {
      const res = await app.request(
        "/games/game-1/achievements?sort=badvalue",
        { method: "POST" },
      );

      expect(res.status).toBe(400);
    });
  });
});
