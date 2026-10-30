import { describe, it, expect, vi, beforeEach } from "vitest";
import { XboxProvider } from "../xbox.provider";
import { ProviderUnavailableError } from "../../lib/provider-error.utils";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? "OK" : "Error",
  json: vi.fn().mockResolvedValue(data),
});

const makeProfileResponse = (overrides = {}) => ({
  content: {
    profileUsers: [
      {
        id: "2533274968382425",
        hostId: "2533274968382425",
        isSponsoredUser: false,
        settings: [
          { id: "Gamertag", value: "BlueMadness9897" },
          { id: "GameDisplayPicRaw", value: "https://example.com/avatar.jpg" },
          { id: "Gamerscore", value: "15763" },
        ],
        ...overrides,
      },
    ],
  },
  code: 200,
});

describe("XboxProvider", () => {
  let provider: XboxProvider;

  beforeEach(() => {
    provider = new XboxProvider("test-openxbl-key");
    mockFetch.mockReset();
  });

  it("throws when constructed without API key", () => {
    expect(() => new XboxProvider("")).toThrow("OPENXBL_API_KEY is missing");
  });

  // ── getPlayerProfile ──────────────────────────────────────────────────────

  describe("getPlayerProfile", () => {
    it("returns normalized profile", async () => {
      mockFetch.mockResolvedValue(makeResponse(makeProfileResponse()));

      const result = await provider.getPlayerProfile("2533274968382425");
      expect(result?.xuid).toBe("2533274968382425");
      expect(result?.gamertag).toBe("BlueMadness9897");
      expect(result?.gamerscore).toBe(15763);
    });

    it("returns null when profileUsers is empty", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({ content: { profileUsers: [] }, code: 200 }),
      );
      const result = await provider.getPlayerProfile("bad-xuid");
      expect(result).toBeNull();
    });

    it("throws on 401 unauthorized", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 401));
      await expect(provider.getPlayerProfile("id")).rejects.toThrow(
        "Invalid or expired OpenXBL API key",
      );
    });

    it("throws on 429 rate limit", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 429));
      await expect(provider.getPlayerProfile("id")).rejects.toThrow(
        "OpenXBL rate limit exceeded",
      );
    });

    it("throws ProviderUnavailableError on schema validation failure", async () => {
      mockFetch.mockResolvedValue(makeResponse({ unexpected: "shape" }));
      await expect(provider.getPlayerProfile("id")).rejects.toThrow(
        ProviderUnavailableError,
      );
    });
  });

  // ── getOwnedGames ─────────────────────────────────────────────────────────

  describe("getOwnedGames", () => {
    it("returns normalized title list", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            titles: [
              {
                titleId: "tid-1",
                name: "Halo Infinite",
                displayImage: "https://example.com/halo.jpg",
                achievement: { totalAchievements: 40, progressPercentage: 75 },
                titleHistory: { lastTimePlayed: "2026-06-01T00:00:00Z" },
              },
            ],
          },
          code: 200,
        }),
      );

      const result = await provider.getOwnedGames("xuid");
      expect(result).toHaveLength(1);
      expect(result[0]!.titleId).toBe("tid-1");
      expect(result[0]!.completionPercentage).toBe(75);
      expect(result[0]!.lastPlayedAt).toBeInstanceOf(Date);
    });

    it("returns empty array when titles is missing", async () => {
      mockFetch.mockResolvedValue(makeResponse({ content: {}, code: 200 }));
      const result = await provider.getOwnedGames("xuid");
      expect(result).toEqual([]);
    });

    // Titles with no achievements can't be tracked, so they are left out of
    // the library on purpose.
    it("drops titles that define no achievements", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            titles: [
              { titleId: "with", name: "With", achievement: { totalAchievements: 12 } },
              { titleId: "zero", name: "Zero", achievement: { totalAchievements: 0 } },
              { titleId: "none", name: "None" },
            ],
          },
          code: 200,
        }),
      );

      const result = await provider.getOwnedGames("xuid");

      expect(result.map((t) => t.titleId)).toEqual(["with"]);
    });

    it("handles null lastTimePlayed gracefully", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            titles: [
              {
                titleId: "tid-1",
                name: "Game",
                achievement: { totalAchievements: 1 },
                titleHistory: { lastTimePlayed: "" },
              },
            ],
          },
          code: 200,
        }),
      );

      const result = await provider.getOwnedGames("xuid");
      expect(result[0]!.lastPlayedAt).toBeNull();
    });
  });

  // ── getPlaytimeMinutes ────────────────────────────────────────────────────

  describe("getPlaytimeMinutes", () => {
    it("returns empty map for empty titleIds array", async () => {
      const result = await provider.getPlaytimeMinutes("xuid", []);
      expect(result.size).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("parses MinutesPlayed from statlistscollection", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            statlistscollection: [
              {
                stats: [
                  { titleid: "tid-1", name: "MinutesPlayed", value: "300" },
                  { titleid: "tid-2", name: "MinutesPlayed", value: "60" },
                ],
              },
            ],
          },
          code: 200,
        }),
      );

      const result = await provider.getPlaytimeMinutes("xuid", [
        "tid-1",
        "tid-2",
      ]);
      expect(result.get("tid-1")).toBe(300);
      expect(result.get("tid-2")).toBe(60);
    });

    it("skips stats with no value", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            statlistscollection: [
              {
                stats: [
                  { titleid: "tid-1", name: "MinutesPlayed" }, // no value field
                ],
              },
            ],
          },
          code: 200,
        }),
      );

      const result = await provider.getPlaytimeMinutes("xuid", ["tid-1"]);
      expect(result.has("tid-1")).toBe(false);
    });

    it("returns empty map on HTTP failure", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      const result = await provider.getPlaytimeMinutes("xuid", ["tid-1"]);
      expect(result.size).toBe(0);
    });
  });

  // ── getPlayerAchievements ─────────────────────────────────────────────────

  describe("getPlayerAchievements", () => {
    // The result is a { status } union; this narrows it to the ok case.
    const okAchievements = (
      r: Awaited<ReturnType<XboxProvider["getPlayerAchievements"]>>,
    ) => {
      if (r.status !== "ok") {
        throw new Error(`expected status "ok", got "${r.status}"`);
      }
      return r.achievements;
    };

    it("returns normalized achievements", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            achievements: [
              {
                id: "1",
                name: "First Win",
                isSecret: false,
                rewards: [
                  { type: "Gamerscore", value: "10" },
                  {
                    type: "Art",
                    mediaAsset: {
                      type: "Icon",
                      url: "https://example.com/icon.png",
                    },
                  },
                ],
                progression: { timeUnlocked: "2026-01-01T00:00:00Z" },
                rarity: { currentPercentage: 45.5 },
              },
            ],
          },
          code: 200,
        }),
      );

      const achievements = okAchievements(
        await provider.getPlayerAchievements("xuid", "tid-1"),
      );
      expect(achievements).toHaveLength(1);
      expect(achievements[0]!.achieved).toBe(true);
      expect(achievements[0]!.gamerscore).toBe(10);
      expect(achievements[0]!.iconUrl).toBe("https://example.com/icon.png");
      expect(achievements[0]!.globalPercentage).toBe(45.5);
    });

    it("reports 'empty' when the title genuinely has no achievements", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({ content: { achievements: [] }, code: 200 }),
      );
      const result = await provider.getPlayerAchievements("xuid", "tid-1");
      expect(result).toEqual({ status: "empty" });
    });

    // An empty list next to a non-zero record count means the response was
    // truncated, not that the game has none — so it must not read as 'empty'.
    it("reports 'error', not 'empty', when the list is empty but totalRecords > 0", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: { achievements: [], pagingInfo: { totalRecords: 37 } },
          code: 200,
        }),
      );
      const result = await provider.getPlayerAchievements("xuid", "tid-1");
      expect(result).toEqual({ status: "error" });
    });

    it("reports 'error' when the request fails", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      const result = await provider.getPlayerAchievements("xuid", "tid-1");
      expect(result).toEqual({ status: "error" });
    });

    it("reports 'error' when the payload doesn't match the schema", async () => {
      mockFetch.mockResolvedValue(makeResponse({ unexpected: "shape" }));
      const result = await provider.getPlayerAchievements("xuid", "tid-1");
      expect(result).toEqual({ status: "error" });
    });

    it("marks achievement as not achieved when timeUnlocked is empty string", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            achievements: [
              {
                id: "1",
                name: "Locked",
                rewards: [
                  { type: "Gamerscore", value: "10", mediaAsset: null },
                ],
                progression: { timeUnlocked: "" },
              },
            ],
          },
          code: 200,
        }),
      );

      const achievements = okAchievements(
        await provider.getPlayerAchievements("xuid", "tid-1"),
      );
      expect(achievements[0]!.achieved).toBe(false);
      expect(achievements[0]!.unlockedAt).toBeNull();
    });

    it("handles null mediaAsset without throwing", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          content: {
            achievements: [
              {
                id: "1",
                name: "Test",
                rewards: [{ type: "Art", mediaAsset: null }],
                progression: { timeUnlocked: "" },
              },
            ],
          },
          code: 200,
        }),
      );

      const achievements = okAchievements(
        await provider.getPlayerAchievements("xuid", "tid-1"),
      );
      expect(achievements[0]!.iconUrl).toBeNull();
    });
  });
});
