import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SteamService } from "../steam.services";

// ── Mock factories ────────────────────────────────────────────────────────────

const makeMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
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
  getPlayerSummary: vi.fn(),
  getOwnedGames: vi.fn(),
  getPlayerAchievements: vi.fn(),
  getGameSchema: vi.fn(),
  getRecentlyPlayedGames: vi.fn(),
});

const makeGame = (overrides = {}) => ({
  id: "game-uuid-1",
  title: "Halo Infinite",
  platform: "steam",
  status: "in-progress",
  iconUrl: null,
  coverUrl: "https://example.com/cover.jpg",
  bannerUrl: "https://example.com/banner.jpg",
  playTime: 120,
  completionPercentage: 50,
  lastPlayedAt: new Date("2026-06-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
  steamAppId: "123456",
  ...overrides,
});

// ── getUserGames ──────────────────────────────────────────────────────────────

describe("SteamService.getUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new SteamService(db as never, provider as never);
  });

  it("returns mapped games for a user", async () => {
    const row = makeGame();
    db.orderBy = vi.fn().mockResolvedValue([row]);

    const result = await service.getUserGames("user-1");

    expect(result).toHaveLength(1);
    const first = result[0]!;
    expect(first.id).toBe("game-uuid-1");
    expect(first.externalId).toBe("123456");
    expect(first.platform).toBe("steam");
  });

  it("returns empty array when user has no games", async () => {
    db.orderBy = vi.fn().mockResolvedValue([]);
    const result = await service.getUserGames("user-1");
    expect(result).toEqual([]);
  });

  it("maps null fields to null", async () => {
    const row = makeGame({
      iconUrl: null,
      coverUrl: null,
      bannerUrl: null,
      lastPlayedAt: null,
    });
    db.orderBy = vi.fn().mockResolvedValue([row]);

    const result = await service.getUserGames("user-1");
    expect(result[0]!.iconUrl).toBeNull();
    expect(result[0]!.coverUrl).toBeNull();
    expect(result[0]!.lastPlayedAt).toBeNull();
  });

  it("defaults null platform to steam", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makeGame({ platform: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.platform).toBe("steam");
  });

  it("defaults null status to backlog", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makeGame({ status: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.status).toBe("backlog");
  });
});

// ── getUserGame ───────────────────────────────────────────────────────────────

describe("SteamService.getUserGame", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    service = new SteamService(db as never, makeMockProvider() as never);
  });

  it("returns a single game by id", async () => {
    db.limit = vi.fn().mockResolvedValue([makeGame()]);
    const result = await service.getUserGame("user-1", "game-uuid-1");
    expect(result?.id).toBe("game-uuid-1");
  });

  it("returns null when game not found", async () => {
    db.limit = vi.fn().mockResolvedValue([]);
    const result = await service.getUserGame("user-1", "nonexistent");
    expect(result).toBeNull();
  });
});

// ── syncUserProfile ───────────────────────────────────────────────────────────

describe("SteamService.syncUserProfile", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new SteamService(db as never, provider as never);
  });

  it("returns steam data on success", async () => {
    const steamData = {
      steamId: "76561198000000000",
      displayName: "TestUser",
      avatar: null,
      profileUrl: null,
    };
    provider.getPlayerSummary.mockResolvedValue(steamData);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([]);
    db.transaction = vi.fn((cb) => cb(tx));

    const result = await service.syncUserProfile("user-1", "76561198000000000");
    expect(result).toEqual(steamData);
  });

  it("throws when Steam profile not found", async () => {
    provider.getPlayerSummary.mockResolvedValue(null);

    await expect(service.syncUserProfile("user-1", "bad-id")).rejects.toThrow(
      "Could not find Steam profile",
    );
  });

  it("throws when provider throws", async () => {
    provider.getPlayerSummary.mockRejectedValue(new Error("Network error"));
    await expect(service.syncUserProfile("user-1", "id")).rejects.toThrow(
      "Network error",
    );
  });
});

// ── syncUserGames ─────────────────────────────────────────────────────────────

describe("SteamService.syncUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new SteamService(db as never, provider as never);
  });

  it("returns empty array when Steam returns no games", async () => {
    provider.getOwnedGames.mockResolvedValue([]);
    const result = await service.syncUserGames("user-1", "steam-id");
    expect(result).toEqual([]);
  });

  it("inserts and returns games", async () => {
    provider.getOwnedGames.mockResolvedValue([
      {
        steamAppId: "123",
        name: "Halo",
        playtimeMinutes: 100,
        iconUrl: null,
        coverUrl: null,
        lastPlayedAt: new Date(),
      },
    ]);

    const inserted = [makeGame()];
    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue(inserted);
    db.transaction = vi.fn((cb) => cb(tx));

    const result = await service.syncUserGames("user-1", "steam-id");
    expect(result).toEqual(inserted);
  });

  it("deduplicates games with same steamAppId", async () => {
    const older = {
      steamAppId: "123",
      name: "Halo",
      playtimeMinutes: 10,
      iconUrl: null,
      coverUrl: null,
      lastPlayedAt: new Date("2025-01-01"),
    };
    const newer = {
      steamAppId: "123",
      name: "Halo",
      playtimeMinutes: 50,
      iconUrl: null,
      coverUrl: null,
      lastPlayedAt: new Date("2026-01-01"),
    };
    provider.getOwnedGames.mockResolvedValue([older, newer]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makeGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1", "steam-id");

    // values() should have been called with exactly 1 item
    const valuesCall = tx.values!.mock.calls[0]![0];
    expect(valuesCall).toHaveLength(1);
    expect(valuesCall[0].playTime).toBe(50); // newer entry wins
  });

  it("throws when provider throws", async () => {
    provider.getOwnedGames.mockRejectedValue(new Error("Steam down"));
    await expect(service.syncUserGames("user-1", "id")).rejects.toThrow(
      "Steam down",
    );
  });
});

// ── syncGameAchievements ──────────────────────────────────────────────────────

describe("SteamService.syncGameAchievements", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new SteamService(db as never, provider as never);
  });

  it("throws when no Steam mapping found for game", async () => {
    db.limit = vi.fn().mockResolvedValue([]);
    await expect(
      service.syncGameAchievements("user-1", "game-1"),
    ).rejects.toThrow("No Steam mapping found");
  });

  it("returns empty array when provider returns null achievements", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValue([{ steamAppId: "123", steamId: "steam-1" }]);
    provider.getPlayerAchievements.mockResolvedValue(null);
    provider.getGameSchema.mockResolvedValue(new Map());

    const result = await service.syncGameAchievements("user-1", "game-1");
    expect(result).toEqual([]);
  });

  it("upserts achievements and updates completionPercentage", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValue([{ steamAppId: "123", steamId: "steam-1" }]);

    const achievements = [
      {
        apiName: "ACH_1",
        achieved: true,
        unlockedAt: new Date(),
        name: "Win",
        description: null,
      },
      {
        apiName: "ACH_2",
        achieved: false,
        unlockedAt: null,
        name: "Lose",
        description: null,
      },
    ];
    provider.getPlayerAchievements.mockResolvedValue(achievements);
    provider.getGameSchema.mockResolvedValue(new Map());

    const upserted = [
      { id: "ach-1", apiName: "ACH_1" },
      { id: "ach-2", apiName: "ACH_2" },
    ];
    const tx = makeMockTx();
    // First returning call = upserted achievements
    tx.returning = vi
      .fn()
      .mockResolvedValueOnce(upserted)
      .mockResolvedValue([]);
    // The select inside transaction for gameRow
    tx.limit = vi
      .fn()
      .mockResolvedValue([{ playTime: 200, lastPlayedAt: new Date() }]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncGameAchievements("user-1", "game-1");

    // update should have been called with 50% completion (1 of 2 achieved)
    const setCall = tx.set.mock.calls.find(
      (call) => call[0]?.completionPercentage !== undefined,
    );
    expect(setCall?.[0].completionPercentage).toBe(50);
  });

  it("sets completionPercentage to 0 when no achievements exist", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValue([{ steamAppId: "123", steamId: "steam-1" }]);
    provider.getPlayerAchievements.mockResolvedValue([]);
    provider.getGameSchema.mockResolvedValue(new Map());

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([]);
    tx.limit = vi.fn().mockResolvedValue([{ playTime: 0, lastPlayedAt: null }]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncGameAchievements("user-1", "game-1");
    const setCall = tx.set.mock.calls.find(
      (call) => call[0]?.completionPercentage !== undefined,
    );
    expect(setCall?.[0].completionPercentage).toBe(0);
  });
});

// ── syncAllGameAchievements ───────────────────────────────────────────────────

describe("SteamService.syncAllGameAchievements", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: SteamService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new SteamService(db as never, provider as never);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes all games in batches", async () => {
    const syncSpy = vi
      .spyOn(service, "syncGameAchievements")
      .mockResolvedValue([]);

    const gameIds = ["g1", "g2", "g3", "g4", "g5", "g6"];
    const promise = service.syncAllGameAchievements("user-1", gameIds);
    await vi.runAllTimersAsync();
    await promise;

    expect(syncSpy).toHaveBeenCalledTimes(6);
  });

  it("continues processing when one game fails", async () => {
    const syncSpy = vi
      .spyOn(service, "syncGameAchievements")
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValue([]);

    const gameIds = ["g1", "g2", "g3"];
    const promise = service.syncAllGameAchievements("user-1", gameIds);
    await vi.runAllTimersAsync();
    await promise;

    expect(syncSpy).toHaveBeenCalledTimes(3);
  });

  it("handles empty gameIds array", async () => {
    const syncSpy = vi.spyOn(service, "syncGameAchievements");
    await service.syncAllGameAchievements("user-1", []);
    expect(syncSpy).not.toHaveBeenCalled();
  });
});
