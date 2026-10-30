import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLibraryController } from "../library.controller";
import { withAuth } from "../../../tests/auth.helpers";

// ── Mock factory ──────────────────────────────────────────────────────────────

// Session JWTs never reach AuthService; it only backs the `bkl_` API-token path.
const makeMockAuthService = () => ({ verifyApiToken: vi.fn() });

const makeMockService = () => ({
  getStats: vi.fn(),
  getUserGames: vi.fn(),
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

  beforeEach(async () => {
    service = makeMockService();
    app = await withAuth(
      createLibraryController(service as never, makeMockAuthService() as never),
    );
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

    expect(service.getStats).toHaveBeenCalledWith("test-user-1");
  });

  it("surfaces service errors as a 500", async () => {
    service.getStats.mockRejectedValue(new Error("DB connection lost"));

    const res = await app.request("/stats");

    expect(res.status).toBe(500);
  });

  it("calls getStats exactly once per request", async () => {
    service.getStats.mockResolvedValue(makeStats());

    await app.request("/stats");

    expect(service.getStats).toHaveBeenCalledTimes(1);
  });
});

// ── GET /games ────────────────────────────────────────────────────────────────

describe("LibraryController GET /games", () => {
  let service: ReturnType<typeof makeMockService>;
  let app: ReturnType<typeof createLibraryController>;

  beforeEach(async () => {
    service = makeMockService();
    service.getUserGames.mockResolvedValue({ games: [{ id: "g1" }], total: 42 });
    app = await withAuth(
      createLibraryController(service as never, makeMockAuthService() as never),
    );
  });

  it("returns the page and the total from the service", async () => {
    const res = await app.request("/games?limit=10&offset=20");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([{ id: "g1" }]);
    expect(body.meta).toEqual({ total: 42, limit: 10, offset: 20 });
  });

  it("scopes the query to the authenticated user and passes the page to SQL", async () => {
    await app.request("/games?limit=10&offset=20");

    expect(service.getUserGames).toHaveBeenCalledWith(
      "test-user-1",
      {},
      { limit: 10, offset: 20 },
    );
  });

  it("defaults to the first 50", async () => {
    await app.request("/games");

    expect(service.getUserGames).toHaveBeenCalledWith("test-user-1", {}, { limit: 50, offset: 0 });
  });

  it("caps limit at 100 and clamps a negative offset to 0", async () => {
    const res = await app.request("/games?limit=100000&offset=-5");
    const body = await res.json();

    expect(body.meta).toMatchObject({ limit: 100, offset: 0 });
    expect(service.getUserGames).toHaveBeenCalledWith("test-user-1", {}, { limit: 100, offset: 0 });
  });

  it("passes the filters through", async () => {
    await app.request("/games?platform=xbox&status=completed&title=halo");

    expect(service.getUserGames).toHaveBeenCalledWith(
      "test-user-1",
      { platform: "xbox", status: "completed", title: "halo" },
      expect.any(Object),
    );
  });

  it.each([
    ["platform", "/games?platform=n64"],
    ["status", "/games?status=abandoned"],
  ])("returns 400 for an invalid %s without querying", async (_name, url) => {
    const res = await app.request(url);

    expect(res.status).toBe(400);
    expect(service.getUserGames).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const anon = createLibraryController(service as never, makeMockAuthService() as never);

    expect((await anon.request("/games")).status).toBe(401);
  });
});
