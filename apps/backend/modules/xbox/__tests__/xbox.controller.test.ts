import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXboxController } from "../xbox.controller";

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
  externalId: "tid-1",
  title: "Halo Infinite",
  platform: "xbox",
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

describe("XboxController", () => {
  let service: ReturnType<typeof makeMockService>;
  let app: ReturnType<typeof createXboxController>;

  beforeEach(() => {
    service = makeMockService();
    app = createXboxController(service as never);
  });

  describe("GET /games", () => {
    it("returns 200 with library", async () => {
      service.getUserGames.mockResolvedValue([makeGame()]);

      const res = await app.request("/games");
      const body = (await res.json()) as {
        data: Array<{ platform: string }>;
      };

      expect(res.status).toBe(200);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]!.platform).toBe("xbox");
    });

    it("returns empty library", async () => {
      service.getUserGames.mockResolvedValue([]);
      const res = await app.request("/games");
      const body = (await res.json()) as {
        data: Array<unknown>;
      };
      expect(body.data).toEqual([]);
    });
  });

  describe("GET /games/:id", () => {
    it("returns 200 with game", async () => {
      service.getUserGame.mockResolvedValue(makeGame());
      const res = await app.request("/games/game-1");
      expect(res.status).toBe(200);
    });

    it("returns 404 when not found", async () => {
      service.getUserGame.mockResolvedValue(null);
      const res = await app.request("/games/missing");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /sync", () => {
    it("returns 200 on valid xuid", async () => {
      service.syncUserProfile.mockResolvedValue({
        xuid: "123",
        gamertag: "BlueMadness",
      });
      service.syncUserGames.mockResolvedValue([makeGame()]);

      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xuid: "2533274968382425" }),
      });
      const body = (await res.json()) as {
        status: string;
        data: { gamesCount: number };
      };

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.gamesCount).toBe(1);
    });

    it("returns 400 for empty xuid", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xuid: "" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when xuid is missing", async () => {
      const res = await app.request("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /games/:gameId/achievements", () => {
    it("returns 200 with achievement data", async () => {
      service.getGameAchievements.mockResolvedValue({
        data: [],
        total: 5,
        unlocked: 3,
      });

      const res = await app.request("/games/game-1/achievements", {
        method: "POST",
      });
      const body = (await res.json()) as {
        meta: { total: number; unlocked: number };
      };
    });
  });
});
