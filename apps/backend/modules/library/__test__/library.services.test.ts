import { describe, it, expect, vi, beforeEach } from "vitest";
import { LibraryService } from "../library.services";

// ── Mock factory ──────────────────────────────────────────────────────────────

const makeMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeGameStats = (overrides = {}) => ({
  games: 10,
  completionPercentage: 45.5,
  completedGames: 2,
  ...overrides,
});

const makeAchStats = (overrides = {}) => ({
  achievements: 150,
  ...overrides,
});

// Each platform stats query fires two DB calls: gameStats then achStats.
// This helper sets up the mock to return them in sequence.
const mockPlatformQueries = (
  db: ReturnType<typeof makeMockDb>,
  gameStats: object,
  achStats: object,
) => {
  db.where = vi
    .fn()
    .mockResolvedValueOnce([gameStats]) // game stats query
    .mockResolvedValueOnce([achStats]); // achievement stats query
};

// ── getStats ──────────────────────────────────────────────────────────────────

describe("LibraryService.getStats", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: LibraryService;

  beforeEach(() => {
    db = makeMockDb();
    service = new LibraryService(db as never);
  });

  it("returns combined totals and per-platform breakdown", async () => {
    db.where = vi
      .fn()
      // Steam: gameStats, achStats
      .mockResolvedValueOnce([
        makeGameStats({
          games: 300,
          completionPercentage: 40,
          completedGames: 10,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 2000 })])
      // Xbox: gameStats, achStats
      .mockResolvedValueOnce([
        makeGameStats({
          games: 50,
          completionPercentage: 60,
          completedGames: 5,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 500 })])
      // PSN: gameStats, achStats
      .mockResolvedValueOnce([
        makeGameStats({
          games: 20,
          completionPercentage: 80,
          completedGames: 8,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 300 })]);

    const result = await service.getStats("user-1");

    // Total games = 300 + 50 + 20
    expect(result.total.games).toBe(370);

    // Total achievements = 2000 + 500 + 300
    expect(result.total.achievements).toBe(2800);

    // Total completed = 10 + 5 + 8
    expect(result.total.completedGames).toBe(23);

    // Breakdown is present for all platforms
    expect(result.breakdown.steam.games).toBe(300);
    expect(result.breakdown.xbox.games).toBe(50);
    expect(result.breakdown.playstation.games).toBe(20);
  });

  it("calculates weighted average completion percentage", async () => {
    db.where = vi
      .fn()
      // Steam: 100 games at 50% completion
      .mockResolvedValueOnce([
        makeGameStats({
          games: 100,
          completionPercentage: 50,
          completedGames: 0,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      // Xbox: 100 games at 100% completion
      .mockResolvedValueOnce([
        makeGameStats({
          games: 100,
          completionPercentage: 100,
          completedGames: 0,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      // PSN: 0 games
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })]);

    const result = await service.getStats("user-1");

    // Weighted avg: (100×50 + 100×100 + 0×0) / 200 = 75
    expect(result.total.completionPercentage).toBe(75);
  });

  it("returns zeros when user has no games on any platform", async () => {
    db.where = vi
      .fn()
      .mockResolvedValue([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ]);

    // Override to always return zero achievements too
    db.where = vi
      .fn()
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })]);

    const result = await service.getStats("user-1");

    expect(result.total.games).toBe(0);
    expect(result.total.achievements).toBe(0);
    expect(result.total.completedGames).toBe(0);
    expect(result.total.completionPercentage).toBe(0);
  });

  it("returns zero completion percentage when total games is 0", async () => {
    db.where = vi
      .fn()
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })]);

    const result = await service.getStats("user-1");

    // No division by zero
    expect(result.total.completionPercentage).toBe(0);
  });

  it("handles null/undefined DB results gracefully with fallback zeros", async () => {
    // Simulate DB returning empty arrays (no rows matched)
    db.where = vi.fn().mockResolvedValue([]);

    const result = await service.getStats("user-1");

    expect(result.total.games).toBe(0);
    expect(result.total.achievements).toBe(0);
    expect(result.total.completedGames).toBe(0);
    expect(result.breakdown.steam.games).toBe(0);
    expect(result.breakdown.xbox.games).toBe(0);
    expect(result.breakdown.playstation.games).toBe(0);
  });

  it("runs all three platform queries in parallel", async () => {
    const callOrder: string[] = [];

    const makePlatformMock = (label: string) =>
      vi.fn().mockImplementation(async () => {
        callOrder.push(label);
        return [makeGameStats()];
      });

    // Spy on the private methods to track call order
    const steamSpy = vi
      .spyOn(service as never, "getSteamStats")
      .mockImplementation(makePlatformMock("steam") as never);
    const xboxSpy = vi
      .spyOn(service as never, "getXboxStats")
      .mockImplementation(makePlatformMock("xbox") as never);
    const psnSpy = vi
      .spyOn(service as never, "getPlaystationStats")
      .mockImplementation(makePlatformMock("psn") as never);

    await service.getStats("user-1");

    expect(steamSpy).toHaveBeenCalledOnce();
    expect(xboxSpy).toHaveBeenCalledOnce();
    expect(psnSpy).toHaveBeenCalledOnce();
  });

  it("propagates errors from platform queries", async () => {
    vi.spyOn(service as never, "getSteamStats").mockRejectedValue(
      new Error("DB connection lost"),
    );

    await expect(service.getStats("user-1")).rejects.toThrow(
      "DB connection lost",
    );
  });
});

// ── getSteamStats (via getStats with other platforms zeroed) ──────────────────

describe("LibraryService steam stats", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: LibraryService;

  beforeEach(() => {
    db = makeMockDb();
    service = new LibraryService(db as never);
  });

  it("returns correct steam breakdown", async () => {
    db.where = vi
      .fn()
      .mockResolvedValueOnce([
        makeGameStats({
          games: 300,
          completionPercentage: 42.5,
          completedGames: 15,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 2500 })])
      // Xbox + PSN return zeros
      .mockResolvedValue([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ]);

    const result = await service.getStats("user-1");

    expect(result.breakdown.steam.games).toBe(300);
    expect(result.breakdown.steam.completionPercentage).toBe(42.5);
    expect(result.breakdown.steam.completedGames).toBe(15);
    expect(result.breakdown.steam.achievements).toBe(2500);
  });
});

// ── getXboxStats ──────────────────────────────────────────────────────────────

describe("LibraryService xbox stats", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: LibraryService;

  beforeEach(() => {
    db = makeMockDb();
    service = new LibraryService(db as never);
  });

  it("returns correct xbox breakdown", async () => {
    db.where = vi
      .fn()
      // Steam returns zeros
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      // Xbox
      .mockResolvedValueOnce([
        makeGameStats({
          games: 75,
          completionPercentage: 55,
          completedGames: 7,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 800 })])
      // PSN returns zeros
      .mockResolvedValue([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ]);

    const result = await service.getStats("user-1");

    expect(result.breakdown.xbox.games).toBe(75);
    expect(result.breakdown.xbox.completionPercentage).toBe(55);
    expect(result.breakdown.xbox.achievements).toBe(800);
  });
});

// ── getPlaystationStats ───────────────────────────────────────────────────────

describe("LibraryService playstation stats", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: LibraryService;

  beforeEach(() => {
    db = makeMockDb();
    service = new LibraryService(db as never);
  });

  it("returns correct psn breakdown", async () => {
    db.where = vi
      .fn()
      // Steam + Xbox return zeros
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      // PSN
      .mockResolvedValueOnce([
        makeGameStats({
          games: 30,
          completionPercentage: 70,
          completedGames: 5,
        }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 400 })]);

    const result = await service.getStats("user-1");

    expect(result.breakdown.playstation.games).toBe(30);
    expect(result.breakdown.playstation.completionPercentage).toBe(70);
    expect(result.breakdown.playstation.achievements).toBe(400);
  });

  it("psn achievements count earned trophies not achievements column", async () => {
    db.where = vi
      .fn()
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({ games: 0, completionPercentage: 0, completedGames: 0 }),
      ])
      .mockResolvedValueOnce([makeAchStats({ achievements: 0 })])
      .mockResolvedValueOnce([
        makeGameStats({
          games: 10,
          completionPercentage: 50,
          completedGames: 1,
        }),
      ])
      // PSN trophies — earned = true filter applied in service
      .mockResolvedValueOnce([{ achievements: 45 }]);

    const result = await service.getStats("user-1");

    expect(result.breakdown.playstation.achievements).toBe(45);
  });
});
