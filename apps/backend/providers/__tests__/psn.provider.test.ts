import { describe, it, expect, vi, beforeEach } from "vitest";
import { PsnProvider } from "../psn.provider";

// Mock the entire psn-api module — we never want real network calls in tests
vi.mock("psn-api", () => ({
  exchangeNpssoForAccessCode: vi.fn(),
  exchangeAccessCodeForAuthTokens: vi.fn(),
  exchangeRefreshTokenForAuthTokens: vi.fn(),
  getProfileFromUserName: vi.fn(),
  getUserTitles: vi.fn(),
  getTitleTrophies: vi.fn(),
  getUserTrophiesEarnedForTitle: vi.fn(),
}));

import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
} from "psn-api";

const mockExchangeNpsso = vi.mocked(exchangeNpssoForAccessCode);
const mockExchangeCode = vi.mocked(exchangeAccessCodeForAuthTokens);
const mockRefreshTokens = vi.mocked(exchangeRefreshTokenForAuthTokens);
const mockGetProfile = vi.mocked(getProfileFromUserName);
const mockGetTitles = vi.mocked(getUserTitles);
const mockGetTitleTrophies = vi.mocked(getTitleTrophies);
const mockGetUserTrophies = vi.mocked(getUserTrophiesEarnedForTitle);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeAuthResponse = (overrides = {}) => ({
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30 days default
  expiresIn: 3600,
  tokenType: "bearer",
  scope: "openid",
  idToken: "id-token",
  ...overrides,
});

const makeProfileResponse = (overrides = {}) => ({
  profile: {
    accountId: "1234567890123456789",
    onlineId: "BlueMadness9897",
    avatarUrls: [{ size: "xl", avatarUrl: "https://example.com/avatar.jpg" }],
    plus: 1,
    aboutMe: "",
    languagesUsed: ["en"],
    trophySummary: {
      level: 50,
      progress: 75,
      earnedTrophies: { bronze: 100, silver: 50, gold: 20, platinum: 5 },
    },
    isOfficiallyVerified: false,
    primaryOnlineStatus: "online",
    presences: [],
    friendRelation: "friend",
    requestMessageFlag: false,
    blocking: false,
    following: false,
    consoleAvailability: { availabilityStatus: "availableNow" },
    ...overrides,
  },
});

const makeTrophyTitle = (overrides = {}) => ({
  npCommunicationId: "NPWR20188_00",
  trophyTitleName: "Astro's Playroom",
  trophyTitleIconUrl: "https://example.com/astro.png",
  trophyTitlePlatform: "PS5",
  npServiceName: "trophy2",
  progress: 75,
  earnedTrophies: { bronze: 10, silver: 5, gold: 2, platinum: 0 },
  lastUpdatedDateTime: "2026-06-01T00:00:00Z",
  ...overrides,
});

const makeTitleTrophy = (overrides = {}) => ({
  trophyId: 1,
  trophyHidden: false,
  trophyType: "bronze",
  trophyName: "First Win",
  trophyDetail: "Win your first match",
  trophyIconUrl: "https://example.com/trophy.png",
  ...overrides,
});

const makeUserTrophy = (overrides = {}) => ({
  trophyId: 1,
  earned: true,
  earnedDateTime: "2026-01-01T00:00:00Z",
  trophyEarnedRate: "45.30",
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PsnProvider", () => {
  let provider: PsnProvider;

  beforeEach(() => {
    provider = new PsnProvider();
    vi.clearAllMocks();
  });

  // ── exchangeNpsso ─────────────────────────────────────────────────────────

  describe("exchangeNpsso", () => {
    it("exchanges NPSSO for tokens successfully", async () => {
      mockExchangeNpsso.mockResolvedValue("auth-code-123");
      mockExchangeCode.mockResolvedValue(makeAuthResponse());

      const result = await provider.exchangeNpsso("valid-npsso-token");

      expect(result.accessToken).toBe("access-token-abc");
      expect(result.refreshToken).toBe("refresh-token-xyz");
      expect(result.accessTokenExpiresAt).toBeGreaterThan(Date.now());
    });

    it("converts expiresIn seconds to absolute timestamp", async () => {
      const before = Date.now();
      mockExchangeNpsso.mockResolvedValue("code");
      mockExchangeCode.mockResolvedValue(makeAuthResponse({ expiresIn: 3600 }));

      const result = await provider.exchangeNpsso("npsso");
      const after = Date.now();

      // Should be approximately now + 3600 seconds
      expect(result.accessTokenExpiresAt).toBeGreaterThanOrEqual(
        before + 3600 * 1000,
      );
      expect(result.accessTokenExpiresAt).toBeLessThanOrEqual(
        after + 3600 * 1000,
      );
    });

    it("throws descriptive error when NPSSO exchange fails", async () => {
      mockExchangeNpsso.mockRejectedValue(new Error("Invalid NPSSO"));

      await expect(provider.exchangeNpsso("bad-npsso")).rejects.toThrow(
        "Failed to exchange NPSSO for PSN tokens",
      );
    });

    it("throws when token exchange step fails", async () => {
      mockExchangeNpsso.mockResolvedValue("code");
      mockExchangeCode.mockRejectedValue(new Error("Token exchange failed"));

      await expect(provider.exchangeNpsso("npsso")).rejects.toThrow(
        "Failed to exchange NPSSO for PSN tokens",
      );
    });
  });

  // ── refreshTokens ─────────────────────────────────────────────────────────

  describe("refreshTokens", () => {
    it("returns new tokens on successful refresh", async () => {
      mockRefreshTokens.mockResolvedValue(
        makeAuthResponse({
          accessToken: "new-access",
          refreshToken: "new-refresh",
        }),
      );

      const result = await provider.refreshTokens("old-refresh-token");

      expect(result.accessToken).toBe("new-access");
      expect(result.refreshToken).toBe("new-refresh");
    });

    it("throws descriptive error when refresh fails", async () => {
      mockRefreshTokens.mockRejectedValue(new Error("Token expired"));

      await expect(provider.refreshTokens("expired-refresh")).rejects.toThrow(
        "PSN refresh token is expired or invalid",
      );
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe("getProfile", () => {
    it("returns normalized profile on success", async () => {
      mockGetProfile.mockResolvedValue(makeProfileResponse() as never);

      const result = await provider.getProfile(
        "access-token",
        "BlueMadness9897",
      );

      expect(result?.accountId).toBe("1234567890123456789");
      expect(result?.onlineId).toBe("BlueMadness9897");
      expect(result?.avatarUrl).toBe("https://example.com/avatar.jpg");
    });

    it("returns null when response has no profile", async () => {
      mockGetProfile.mockResolvedValue({} as never);

      const result = await provider.getProfile("token", "user");
      expect(result).toBeNull();
    });

    it("returns null avatarUrl when avatarUrls is empty", async () => {
      mockGetProfile.mockResolvedValue(
        makeProfileResponse({ avatarUrls: [] }) as never,
      );

      const result = await provider.getProfile("token", "user");
      expect(result?.avatarUrl).toBeNull();
    });

    it("throws descriptive error on API failure", async () => {
      mockGetProfile.mockRejectedValue(new Error("Network error"));

      await expect(provider.getProfile("token", "user")).rejects.toThrow(
        "Could not fetch PSN profile",
      );
    });
  });

  // ── getOwnedGames ─────────────────────────────────────────────────────────

  describe("getOwnedGames", () => {
    it("returns normalized title list", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [makeTrophyTitle()],
        totalItemCount: 1,
        nextOffset: null,
      } as never);

      const result = await provider.getOwnedGames("access-token");

      expect(result).toHaveLength(1);
      expect(result[0]!.npCommunicationId).toBe("NPWR20188_00");
      expect(result[0]!.name).toBe("Astro's Playroom");
      expect(result[0]!.npServiceName).toBe("trophy2");
      expect(result[0]!.completionPercentage).toBe(75);
    });

    it("sets npServiceName to trophy for non-PS5 titles", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [
          makeTrophyTitle({
            npServiceName: "trophy",
            trophyTitlePlatform: "PS4",
          }),
        ],
        totalItemCount: 1,
      } as never);

      const result = await provider.getOwnedGames("token");
      expect(result[0]!.npServiceName).toBe("trophy");
    });

    it("sets platinumEarned true when platinum count >= 1", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [
          makeTrophyTitle({
            earnedTrophies: { bronze: 10, silver: 5, gold: 2, platinum: 1 },
          }),
        ],
        totalItemCount: 1,
      } as never);

      const result = await provider.getOwnedGames("token");
      expect(result[0]!.platinumEarned).toBe(true);
    });

    it("sets platinumEarned false when platinum count is 0", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [
          makeTrophyTitle({
            earnedTrophies: { bronze: 5, silver: 2, gold: 1, platinum: 0 },
          }),
        ],
        totalItemCount: 1,
      } as never);

      const result = await provider.getOwnedGames("token");
      expect(result[0]!.platinumEarned).toBe(false);
    });

    it("returns empty array when trophyTitles is empty", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [],
        totalItemCount: 0,
      } as never);

      const result = await provider.getOwnedGames("token");
      expect(result).toEqual([]);
    });

    it("handles null lastUpdatedDateTime", async () => {
      mockGetTitles.mockResolvedValue({
        trophyTitles: [makeTrophyTitle({ lastUpdatedDateTime: null })],
        totalItemCount: 1,
      } as never);

      const result = await provider.getOwnedGames("token");
      expect(result[0]!.lastUpdatedDateTime).toBeNull();
    });

    it("throws when API call fails", async () => {
      mockGetTitles.mockRejectedValue(new Error("PSN down"));

      await expect(provider.getOwnedGames("token")).rejects.toThrow(
        "Could not fetch PSN game library",
      );
    });
  });

  // ── getGameTrophies ───────────────────────────────────────────────────────

  describe("getGameTrophies", () => {
    it("returns merged trophy metadata and earn state", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [makeTitleTrophy()],
        totalItemCount: 1,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [makeUserTrophy()],
        totalItemCount: 1,
      } as never);

      const result = await provider.getGameTrophies(
        "token",
        "NPWR20188_00",
        "trophy2",
      );

      expect(result).toHaveLength(1);
      expect(result![0]!.trophyId).toBe("1");
      expect(result![0]!.name).toBe("First Win");
      expect(result![0]!.earned).toBe(true);
      expect(result![0]!.trophyEarnedRate).toBe(45.3);
      expect(result![0]!.earnedDateTime).toBeInstanceOf(Date);
    });

    it("returns null when trophies array is empty", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [],
        totalItemCount: 0,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [],
        totalItemCount: 0,
      } as never);

      const result = await provider.getGameTrophies(
        "token",
        "NPWR99999_00",
        "trophy2",
      );
      expect(result).toBeNull();
    });

    it("marks trophy as not earned when earned is false", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [makeTitleTrophy()],
        totalItemCount: 1,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [makeUserTrophy({ earned: false, earnedDateTime: null })],
        totalItemCount: 1,
      } as never);

      const result = await provider.getGameTrophies(
        "token",
        "NPWR20188_00",
        "trophy2",
      );

      expect(result![0]!.earned).toBe(false);
      expect(result![0]!.earnedDateTime).toBeNull();
    });

    it("handles null trophyEarnedRate", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [makeTitleTrophy()],
        totalItemCount: 1,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [makeUserTrophy({ trophyEarnedRate: null })],
        totalItemCount: 1,
      } as never);

      const result = await provider.getGameTrophies(
        "token",
        "NPWR20188_00",
        "trophy2",
      );
      expect(result![0]!.trophyEarnedRate).toBeNull();
    });

    it("passes npServiceName option for PS3/PS4 titles", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [],
        totalItemCount: 0,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [],
        totalItemCount: 0,
      } as never);

      await provider.getGameTrophies("token", "NPWR00001_00", "trophy");

      expect(mockGetTitleTrophies).toHaveBeenCalledWith(
        { accessToken: "token" },
        "NPWR00001_00",
        "all",
        { npServiceName: "trophy" },
      );
    });

    it("returns null on API failure without throwing", async () => {
      mockGetTitleTrophies.mockRejectedValue(new Error("Trophy API error"));

      const result = await provider.getGameTrophies(
        "token",
        "NPWR20188_00",
        "trophy2",
      );
      expect(result).toBeNull();
    });

    it("fetches both metadata and earn state in parallel", async () => {
      mockGetTitleTrophies.mockResolvedValue({
        trophies: [makeTitleTrophy()],
        totalItemCount: 1,
      } as never);
      mockGetUserTrophies.mockResolvedValue({
        trophies: [makeUserTrophy()],
        totalItemCount: 1,
      } as never);

      await provider.getGameTrophies("token", "NPWR20188_00", "trophy2");

      // Both should have been called exactly once
      expect(mockGetTitleTrophies).toHaveBeenCalledTimes(1);
      expect(mockGetUserTrophies).toHaveBeenCalledTimes(1);
    });
  });
});
