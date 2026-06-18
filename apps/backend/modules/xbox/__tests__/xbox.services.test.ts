import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { XboxService } from "../xbox.services";

const makeMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(makeMockTx())),
});

const makeMockTx = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
});

const makeMockProvider = () => ({
  getPlayerProfile: vi.fn(),
  getOwnedGames: vi.fn(),
  getPlaytimeMinutes: vi.fn(),
  getPlayerAchievements: vi.fn(),
});

const makeXboxGame = (overrides = {}) => ({
  id: "game-uuid-1",
  title: "Halo Infinite",
  platform: "xbox",
  status: "in-progress",
  iconUrl: null,
  coverUrl: "https://example.com/cover.jpg",
  bannerUrl: "https://example.com/cover.jpg",
  playTime: 120,
  completionPercentage: 50,
  lastPlayedAt: new Date("2026-06-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
  titleId: "titleId-123",
  ...overrides,
});

// ── getUserGames ──────────────────────────────────────────────────────────────

describe("XboxService.getUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: XboxService;

  beforeEach(() => {
    db = makeMockDb();
    service = new XboxService(db as never, makeMockProvider() as never);
  });

  it("returns mapped games", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makeXboxGame()]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.externalId).toBe("titleId-123");
    expect(result[0]!.platform).toBe("xbox");
  });

  it("returns empty array when no games", async () => {
    db.orderBy = vi.fn().mockResolvedValue([]);
    const result = await service.getUserGames("user-1");
    expect(result).toEqual([]);
  });

  it("defaults null platform to xbox", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makeXboxGame({ platform: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.platform).toBe("xbox");
  });
});

// ── syncUserProfile ───────────────────────────────────────────────────────────

describe("XboxService.syncUserProfile", () => {
  let provider: ReturnType<typeof makeMockProvider>;
  let service: XboxService;

  beforeEach(() => {
    const db = makeMockDb();
    provider = makeMockProvider();
    service = new XboxService(db as never, provider as never);
  });

  it("returns xbox profile data on success", async () => {
    const profile = {
      xuid: "123",
      gamertag: "BlueMadness",
      avatarUrl: null,
      gamerscore: 1000,
    };
    provider.getPlayerProfile.mockResolvedValue(profile);

    const result = await service.syncUserProfile("user-1", "123");
    expect(result).toEqual(profile);
  });

  it("throws when profile not found", async () => {
    provider.getPlayerProfile.mockResolvedValue(null);
    await expect(service.syncUserProfile("user-1", "bad")).rejects.toThrow(
      "Could not find Xbox profile",
    );
  });
});

// ── syncUserGames ─────────────────────────────────────────────────────────────

describe("XboxService.syncUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: XboxService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new XboxService(db as never, provider as never);
  });

  it("returns empty array when no titles", async () => {
    provider.getOwnedGames.mockResolvedValue([]);
    const result = await service.syncUserGames("user-1", "xuid-1");
    expect(result).toEqual([]);
    expect(provider.getPlaytimeMinutes).not.toHaveBeenCalled();
  });

  it("merges playtime into titles before inserting", async () => {
    provider.getOwnedGames.mockResolvedValue([
      {
        titleId: "tid1",
        name: "Halo",
        playtimeMinutes: 0,
        coverUrl: null,
        lastPlayedAt: null,
        completionPercentage: 0,
      },
    ]);
    provider.getPlaytimeMinutes.mockResolvedValue(new Map([["tid1", 300]]));

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makeXboxGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1", "xuid-1");

    const valuesCall = tx!.values.mock.calls[0]![0];
    expect(valuesCall[0].playTime).toBe(300);
  });

  it("deduplicates titles with same name keeping most recent", async () => {
    provider.getOwnedGames.mockResolvedValue([
      {
        titleId: "tid1",
        name: "Minecraft",
        playtimeMinutes: 0,
        coverUrl: null,
        lastPlayedAt: new Date("2025-01-01"),
        completionPercentage: 0,
      },
      {
        titleId: "tid2",
        name: "Minecraft",
        playtimeMinutes: 0,
        coverUrl: null,
        lastPlayedAt: new Date("2026-01-01"),
        completionPercentage: 0,
      },
    ]);
    provider.getPlaytimeMinutes.mockResolvedValue(new Map());

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makeXboxGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1", "xuid-1");

    const valuesCall = tx!.values.mock.calls[0]![0];
    expect(valuesCall).toHaveLength(1);
    expect(valuesCall[0].lastPlayedAt).toEqual(new Date("2026-01-01"));
  });

  it("uses 0 playtime when not in playtime map", async () => {
    provider.getOwnedGames.mockResolvedValue([
      {
        titleId: "tid1",
        name: "Game",
        playtimeMinutes: 0,
        coverUrl: null,
        lastPlayedAt: null,
        completionPercentage: 0,
      },
    ]);
    provider.getPlaytimeMinutes.mockResolvedValue(new Map()); // empty map

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makeXboxGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1", "xuid-1");

    const valuesCall = tx!.values.mock.calls[0]![0];
    expect(valuesCall[0].playTime).toBe(0);
  });
});

// ── syncGameAchievements ──────────────────────────────────────────────────────

describe("XboxService.syncGameAchievements", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: XboxService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new XboxService(db as never, provider as never);
  });

  it("throws when no Xbox mapping found", async () => {
    db.limit = vi.fn().mockResolvedValue([]);
    await expect(
      service.syncGameAchievements("user-1", "game-1"),
    ).rejects.toThrow("No Xbox mapping found");
  });

  it("returns empty array when provider returns null", async () => {
    db.limit = vi.fn().mockResolvedValue([{ titleId: "tid1", xuid: "xuid1" }]);
    provider.getPlayerAchievements.mockResolvedValue(null);

    const result = await service.syncGameAchievements("user-1", "game-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when provider returns empty achievements", async () => {
    db.limit = vi.fn().mockResolvedValue([{ titleId: "tid1", xuid: "xuid1" }]);
    provider.getPlayerAchievements.mockResolvedValue([]);

    const result = await service.syncGameAchievements("user-1", "game-1");
    expect(result).toEqual([]);
  });

  it("calculates completionPercentage correctly", async () => {
    db.limit = vi.fn().mockResolvedValue([{ titleId: "tid1", xuid: "xuid1" }]);
    provider.getPlayerAchievements.mockResolvedValue([
      {
        apiName: "1",
        name: "Win",
        achieved: true,
        unlockedAt: new Date(),
        description: null,
        isSecret: false,
        iconUrl: null,
        gamerscore: 10,
        globalPercentage: null,
      },
      {
        apiName: "2",
        name: "Lose",
        achieved: true,
        unlockedAt: new Date(),
        description: null,
        isSecret: false,
        iconUrl: null,
        gamerscore: 10,
        globalPercentage: null,
      },
      {
        apiName: "3",
        name: "Draw",
        achieved: false,
        unlockedAt: null,
        description: null,
        isSecret: false,
        iconUrl: null,
        gamerscore: 10,
        globalPercentage: null,
      },
    ]);

    const tx = makeMockTx();
    tx.returning = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "a1", apiName: "1" },
        { id: "a2", apiName: "2" },
        { id: "a3", apiName: "3" },
      ])
      .mockResolvedValue([]);
    tx.limit = vi
      .fn()
      .mockResolvedValue([{ playTime: 200, lastPlayedAt: new Date() }]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncGameAchievements("user-1", "game-1");

    const setCall = tx.set.mock.calls.find(
      (c) => c[0]?.completionPercentage !== undefined,
    );
    // 2 of 3 achieved = 66.666...
    expect(setCall?.[0].completionPercentage).toBeCloseTo(66.67, 1);
  });
});

// ── syncAllGameAchievements ───────────────────────────────────────────────────

describe("XboxService.syncAllGameAchievements", () => {
  let service: XboxService;

  beforeEach(() => {
    service = new XboxService(
      makeMockDb() as never,
      makeMockProvider() as never,
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes all games", async () => {
    const spy = vi.spyOn(service, "syncGameAchievements").mockResolvedValue([]);
    const promise = service.syncAllGameAchievements("user-1", [
      "g1",
      "g2",
      "g3",
    ]);
    await vi.runAllTimersAsync();
    await promise;
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("skips failed games and continues", async () => {
    const spy = vi
      .spyOn(service, "syncGameAchievements")
      .mockRejectedValueOnce(new Error("Rate limit"))
      .mockResolvedValue([]);

    const promise = service.syncAllGameAchievements("user-1", ["g1", "g2"]);
    await vi.runAllTimersAsync();
    await promise;
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does nothing for empty array", async () => {
    const spy = vi.spyOn(service, "syncGameAchievements");
    await service.syncAllGameAchievements("user-1", []);
    expect(spy).not.toHaveBeenCalled();
  });
});
