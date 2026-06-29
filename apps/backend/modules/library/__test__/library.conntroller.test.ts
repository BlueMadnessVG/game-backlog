import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLibraryController } from "../library.controller";

// ── Mock factory ──────────────────────────────────────────────────────────────

const makeMockService = () => ({
  getStats: vi.fn(),
});

const makePlatformStats = (overrides = {}) => ({
  games: 10,
  completionPercentage: 45.5,
  achievements: 150,
  completedGames: 2,
  ...overrides,
});

const makeStats = (overrides = {}) => ({
  total: makePlatformStats({ games: 30, achievements: 450, completedGames: 6 }),
  breakdown: {
    steam: makePlatformStats({ games: 10 }),
    xbox: makePlatformStats({ games: 10 }),
    playstation: makePlatformStats({ games: 10 }),
  },
  ...overrides,
});

// ── GET /stats ────────────────────────────────────────────────────────────────

describe("LibraryController GET /stats", () => {
  let service: ReturnType<typeof makeMockService>;
  let app: ReturnType<typeof createLibraryController>;

  beforeEach(() => {
    service = makeMockService();
    app = createLibraryController(service as never);
  });

  it("returns 200 with stats data", async () => {
    service.getStats.mockResolvedValue(makeStats());

    const res = await app.request("/stats");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("SUCCESS");
    expect(body.data).toBeDefined();
  });

  it("returns total games across all platforms", async () => {
    service.getStats.mockResolvedValue(
      makeStats({
        total: makePlatformStats({
          games: 370,
          achievements: 2800,
          completedGames: 23,
        }),
      }),
    );

    const res = await app.request("/stats");
    const body = await res.json();

    expect(body.data.total.games).toBe(370);
    expect(body.data.total.achievements).toBe(2800);
    expect(body.data.total.completedGames).toBe(23);
  });

  it("returns per-platform breakdown", async () => {
    service.getStats.mockResolvedValue(
      makeStats({
        breakdown: {
          steam: makePlatformStats({ games: 300, achievements: 2000 }),
          xbox: makePlatformStats({ games: 50, achievements: 500 }),
          playstation: makePlatformStats({ games: 20, achievements: 300 }),
        },
      }),
    );

    const res = await app.request("/stats");
    const body = await res.json();

    expect(body.data.breakdown.steam.games).toBe(300);
    expect(body.data.breakdown.xbox.games).toBe(50);
    expect(body.data.breakdown.playstation.games).toBe(20);
  });

  it("returns correct completionPercentage in total", async () => {
    service.getStats.mockResolvedValue(
      makeStats({
        total: makePlatformStats({ completionPercentage: 75 }),
      }),
    );

    const res = await app.request("/stats");
    const body = await res.json();

    expect(body.data.total.completionPercentage).toBe(75);
  });

  it("returns zeros when user has no synced data", async () => {
    service.getStats.mockResolvedValue({
      total: makePlatformStats({
        games: 0,
        achievements: 0,
        completedGames: 0,
        completionPercentage: 0,
      }),
      breakdown: {
        steam: makePlatformStats({
          games: 0,
          achievements: 0,
          completedGames: 0,
          completionPercentage: 0,
        }),
        xbox: makePlatformStats({
          games: 0,
          achievements: 0,
          completedGames: 0,
          completionPercentage: 0,
        }),
        playstation: makePlatformStats({
          games: 0,
          achievements: 0,
          completedGames: 0,
          completionPercentage: 0,
        }),
      },
    });

    const res = await app.request("/stats");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total.games).toBe(0);
    expect(body.data.total.achievements).toBe(0);
  });

  it("passes userId to service", async () => {
    service.getStats.mockResolvedValue(makeStats());

    await app.request("/stats");

    expect(service.getStats).toHaveBeenCalledWith(
      "8234858e-0f4b-4860-9f5e-26f633355462",
    );
  });

  it("throws when service throws — error propagates to error handler", async () => {
    service.getStats.mockRejectedValue(new Error("DB connection lost"));

    await expect(app.request("/stats")).rejects.toThrow("DB connection lost");
  });

  it("calls getStats exactly once per request", async () => {
    service.getStats.mockResolvedValue(makeStats());

    await app.request("/stats");

    expect(service.getStats).toHaveBeenCalledTimes(1);
  });
});
