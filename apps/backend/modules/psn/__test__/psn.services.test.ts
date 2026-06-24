import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PsnService } from "../psn.services";

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
  exchangeNpsso: vi.fn(),
  refreshTokens: vi.fn(),
  getProfile: vi.fn(),
  getOwnedGames: vi.fn(),
  getGameTrophies: vi.fn(),
});

const makeTokens = (overrides = {}) => ({
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  accessTokenExpiresAt: Date.now() + 3600 * 1000, // 1 hour from now
  ...overrides,
});

const makeAccount = (overrides = {}) => ({
  accessToken: "stored-access-token",
  refreshToken: "stored-refresh-token",
  // Not expired — 1 hour from now
  accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  ...overrides,
});

const makePsnGame = (overrides = {}) => ({
  id: "game-uuid-1",
  title: "Astro's Playroom",
  platform: "playstation",
  status: "in-progress",
  iconUrl: "https://example.com/astro.png",
  coverUrl: "https://example.com/astro.png",
  bannerUrl: "https://example.com/astro.png",
  playTime: 0,
  completionPercentage: 75,
  lastPlayedAt: new Date("2026-06-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
  npCommunicationId: "NPWR20188_00",
  ...overrides,
});

const makePsnTitle = (overrides = {}) => ({
  npCommunicationId: "NPWR20188_00",
  name: "Astro's Playroom",
  iconUrl: "https://example.com/astro.png",
  trophyTitlePlatform: "PS5",
  npServiceName: "trophy2" as const,
  completionPercentage: 75,
  platinumEarned: false,
  lastUpdatedDateTime: "2026-06-01T00:00:00Z",
  ...overrides,
});

const makePsnTrophy = (overrides = {}) => ({
  trophyId: "1",
  name: "First Win",
  detail: "Win your first match",
  trophyType: "bronze" as const,
  trophyHidden: false,
  trophyIconUrl: "https://example.com/trophy.png",
  trophyEarnedRate: 45.3,
  earned: true,
  earnedDateTime: new Date("2026-01-01"),
  ...overrides,
});

// ── getValidAccessToken (via public methods) ───────────────────────────────────

describe("PsnService token management", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new PsnService(db as never, provider as never);
  });

  it("uses stored token when not expired", async () => {
    db.limit = vi.fn().mockResolvedValue([makeAccount()]);
    db.orderBy = vi.fn().mockResolvedValue([]);

    await service.getUserGames("user-1");

    expect(provider.refreshTokens).not.toHaveBeenCalled();
  });

  it("refreshes token when expired and persists new tokens", async () => {
    db.limit = vi.fn().mockResolvedValue([
      makeAccount({
        accessTokenExpiresAt: new Date(Date.now() - 1000), // expired
      }),
    ]);
    provider.refreshTokens.mockResolvedValue(makeTokens());
    db.orderBy = vi.fn().mockResolvedValue([]);

    await service.getUserGames("user-1");

    expect(provider.refreshTokens).toHaveBeenCalledOnce();
    expect(db.update).toHaveBeenCalled();
  });

  it("throws when no PSN account linked", async () => {
    db.limit = vi.fn().mockResolvedValue([]);

    await expect(service.getUserGames("user-1")).rejects.toThrow(
      "No PSN account linked",
    );
  });
});

// ── getUserGames ──────────────────────────────────────────────────────────────

describe("PsnService.getUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    service = new PsnService(db as never, makeMockProvider() as never);
    // Default: valid token always available
    db.limit = vi.fn().mockResolvedValue([makeAccount()]);
  });

  it("returns mapped games", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makePsnGame()]);

    const result = await service.getUserGames("user-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.externalId).toBe("NPWR20188_00");
    expect(result[0]!.platform).toBe("playstation");
  });

  it("returns empty array when no games", async () => {
    db.orderBy = vi.fn().mockResolvedValue([]);
    const result = await service.getUserGames("user-1");
    expect(result).toEqual([]);
  });

  it("defaults null platform to playstation", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makePsnGame({ platform: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.platform).toBe("playstation");
  });

  it("defaults null status to backlog", async () => {
    db.orderBy = vi.fn().mockResolvedValue([makePsnGame({ status: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.status).toBe("backlog");
  });

  it("maps null lastPlayedAt to null", async () => {
    db.orderBy = vi
      .fn()
      .mockResolvedValue([makePsnGame({ lastPlayedAt: null })]);
    const result = await service.getUserGames("user-1");
    expect(result[0]!.lastPlayedAt).toBeNull();
  });
});

// ── getUserGame ───────────────────────────────────────────────────────────────

describe("PsnService.getUserGame", () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    service = new PsnService(db as never, makeMockProvider() as never);
  });

  it("returns a single game", async () => {
    db.limit = vi.fn().mockResolvedValue([makePsnGame()]);
    const result = await service.getUserGame("user-1", "game-uuid-1");
    expect(result?.id).toBe("game-uuid-1");
    expect(result?.externalId).toBe("NPWR20188_00");
  });

  it("returns null when game not found", async () => {
    db.limit = vi.fn().mockResolvedValue([]);
    const result = await service.getUserGame("user-1", "nonexistent");
    expect(result).toBeNull();
  });
});

// ── syncUserProfile ───────────────────────────────────────────────────────────

describe("PsnService.syncUserProfile", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new PsnService(db as never, provider as never);
  });

  it("exchanges NPSSO, fetches profile, and persists tokens", async () => {
    const tokens = makeTokens();
    const profile = {
      accountId: "123",
      onlineId: "BlueMadness",
      avatarUrl: null,
      tokens,
    };

    provider.exchangeNpsso.mockResolvedValue(tokens);
    provider.getProfile.mockResolvedValue(profile);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([]);
    db.transaction = vi.fn((cb) => cb(tx));

    const result = await service.syncUserProfile(
      "user-1",
      "npsso-token",
      "BlueMadness",
    );

    expect(provider.exchangeNpsso).toHaveBeenCalledWith("npsso-token");
    expect(provider.getProfile).toHaveBeenCalledWith(
      tokens.accessToken,
      "BlueMadness",
    );
    expect(result.accountId).toBe("123");
  });

  it("throws when profile not found", async () => {
    provider.exchangeNpsso.mockResolvedValue(makeTokens());
    provider.getProfile.mockResolvedValue(null);

    await expect(
      service.syncUserProfile("user-1", "npsso", "unknown-user"),
    ).rejects.toThrow("Could not find PSN profile");
  });

  it("throws when NPSSO exchange fails", async () => {
    provider.exchangeNpsso.mockRejectedValue(new Error("Invalid NPSSO"));

    await expect(
      service.syncUserProfile("user-1", "bad-npsso", "user"),
    ).rejects.toThrow("Invalid NPSSO");
  });
});

// ── syncUserGames ─────────────────────────────────────────────────────────────

describe("PsnService.syncUserGames", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new PsnService(db as never, provider as never);
    db.limit = vi.fn().mockResolvedValue([makeAccount()]);
  });

  it("returns empty array when PSN returns no titles", async () => {
    provider.getOwnedGames.mockResolvedValue([]);
    const result = await service.syncUserGames("user-1");
    expect(result).toEqual([]);
  });

  it("inserts and returns games", async () => {
    provider.getOwnedGames.mockResolvedValue([makePsnTitle()]);

    const inserted = [makePsnGame()];
    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue(inserted);
    db.transaction = vi.fn((cb) => cb(tx));

    const result = await service.syncUserGames("user-1");
    expect(result).toEqual(inserted);
  });

  it("deduplicates titles with same npCommunicationId keeping highest completion", async () => {
    provider.getOwnedGames.mockResolvedValue([
      makePsnTitle({ completionPercentage: 30 }),
      makePsnTitle({ completionPercentage: 75 }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makePsnGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1");

    const valuesCall = tx.values.mock.calls[0]![0];
    expect(valuesCall).toHaveLength(1);
    expect(valuesCall[0].completionPercentage).toBe(75);
  });

  it("converts lastUpdatedDateTime to Date for lastPlayedAt", async () => {
    provider.getOwnedGames.mockResolvedValue([
      makePsnTitle({ lastUpdatedDateTime: "2026-06-01T00:00:00Z" }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makePsnGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1");

    const valuesCall = tx.values.mock.calls[0]![0];
    expect(valuesCall[0].lastPlayedAt).toBeInstanceOf(Date);
  });

  it("sets lastPlayedAt to null when lastUpdatedDateTime is null", async () => {
    provider.getOwnedGames.mockResolvedValue([
      makePsnTitle({ lastUpdatedDateTime: null }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makePsnGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1");

    const valuesCall = tx.values.mock.calls[0]![0];
    expect(valuesCall[0].lastPlayedAt).toBeNull();
  });

  it("always sets playTime to 0 (PSN has no playtime API)", async () => {
    provider.getOwnedGames.mockResolvedValue([makePsnTitle()]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makePsnGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1");

    const valuesCall = tx.values.mock.calls[0]![0];
    expect(valuesCall[0].playTime).toBe(0);
  });

  it("derives completed status from platinumEarned", async () => {
    provider.getOwnedGames.mockResolvedValue([
      makePsnTitle({ platinumEarned: true, completionPercentage: 80 }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi.fn().mockResolvedValue([makePsnGame()]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncUserGames("user-1");

    const valuesCall = tx.values.mock.calls[0]![0];
    expect(valuesCall[0].status).toBe("completed");
  });
});

// ── syncGameTrophies ──────────────────────────────────────────────────────────

describe("PsnService.syncGameTrophies", () => {
  let db: ReturnType<typeof makeMockDb>;
  let provider: ReturnType<typeof makeMockProvider>;
  let service: PsnService;

  beforeEach(() => {
    db = makeMockDb();
    provider = makeMockProvider();
    service = new PsnService(db as never, provider as never);
  });

  it("throws when no PSN mapping found for game", async () => {
    db.limit = vi.fn().mockResolvedValue([]);

    await expect(service.syncGameTrophies("user-1", "game-1")).rejects.toThrow(
      "No PSN mapping found",
    );
  });

  it("returns empty array when provider returns null trophies", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValueOnce([
        { npCommunicationId: "NPWR20188_00", npServiceName: "trophy2" },
      ])
      .mockResolvedValueOnce([makeAccount()]);

    provider.getGameTrophies.mockResolvedValue(null);

    const result = await service.syncGameTrophies("user-1", "game-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when provider returns empty trophies", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValueOnce([
        { npCommunicationId: "NPWR20188_00", npServiceName: "trophy2" },
      ])
      .mockResolvedValueOnce([makeAccount()]);

    provider.getGameTrophies.mockResolvedValue([]);

    const result = await service.syncGameTrophies("user-1", "game-1");
    expect(result).toEqual([]);
  });

  it("calculates completionPercentage from earned trophies", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValueOnce([
        { npCommunicationId: "NPWR20188_00", npServiceName: "trophy2" },
      ])
      .mockResolvedValueOnce([makeAccount()]);

    provider.getGameTrophies.mockResolvedValue([
      makePsnTrophy({ trophyId: "1", earned: true }),
      makePsnTrophy({ trophyId: "2", earned: true }),
      makePsnTrophy({ trophyId: "3", earned: false }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "uuid-1", trophyId: "1" },
        { id: "uuid-2", trophyId: "2" },
        { id: "uuid-3", trophyId: "3" },
      ])
      .mockResolvedValue([]);
    tx.limit = vi.fn().mockResolvedValue([{ playTime: 0, lastPlayedAt: null }]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncGameTrophies("user-1", "game-1");

    const setCall = tx.set.mock.calls.find(
      (c) => c[0]?.completionPercentage !== undefined,
    );
    // 2 of 3 earned = 66.67%
    expect(setCall?.[0].completionPercentage).toBeCloseTo(66.67, 1);
  });

  it("sets status to completed when platinum trophy is earned", async () => {
    db.limit = vi
      .fn()
      .mockResolvedValueOnce([
        { npCommunicationId: "NPWR20188_00", npServiceName: "trophy2" },
      ])
      .mockResolvedValueOnce([makeAccount()]);

    provider.getGameTrophies.mockResolvedValue([
      makePsnTrophy({ trophyId: "1", trophyType: "platinum", earned: true }),
      makePsnTrophy({ trophyId: "2", trophyType: "bronze", earned: true }),
    ]);

    const tx = makeMockTx();
    tx.returning = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "uuid-1", trophyId: "1" },
        { id: "uuid-2", trophyId: "2" },
      ])
      .mockResolvedValue([]);
    tx.limit = vi.fn().mockResolvedValue([{ playTime: 0, lastPlayedAt: null }]);
    db.transaction = vi.fn((cb) => cb(tx));

    await service.syncGameTrophies("user-1", "game-1");

    const setCall = tx.set.mock.calls.find((c) => c[0]?.status !== undefined);
    expect(setCall?.[0].status).toBe("completed");
  });
});

// ── syncAllGameTrophies ───────────────────────────────────────────────────────

describe("PsnService.syncAllGameTrophies", () => {
  let service: PsnService;

  beforeEach(() => {
    service = new PsnService(
      makeMockDb() as never,
      makeMockProvider() as never,
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes all games in batches", async () => {
    const spy = vi.spyOn(service, "syncGameTrophies").mockResolvedValue([]);

    const promise = service.syncAllGameTrophies("user-1", [
      "g1",
      "g2",
      "g3",
      "g4",
      "g5",
      "g6",
    ]);
    await vi.runAllTimersAsync();
    await promise;

    expect(spy).toHaveBeenCalledTimes(6);
  });

  it("continues when one game fails", async () => {
    const spy = vi
      .spyOn(service, "syncGameTrophies")
      .mockRejectedValueOnce(new Error("PSN error"))
      .mockResolvedValue([]);

    const promise = service.syncAllGameTrophies("user-1", ["g1", "g2", "g3"]);
    await vi.runAllTimersAsync();
    await promise;

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("does nothing for empty array", async () => {
    const spy = vi.spyOn(service, "syncGameTrophies");
    await service.syncAllGameTrophies("user-1", []);
    expect(spy).not.toHaveBeenCalled();
  });
});
