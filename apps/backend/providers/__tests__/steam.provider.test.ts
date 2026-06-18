import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SteamProvider } from "../steam.provider";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? "OK" : "Error",
  json: vi.fn().mockResolvedValue(data),
});

describe("SteamProvider", () => {
  let provider: SteamProvider;

  beforeEach(() => {
    provider = new SteamProvider("test-api-key");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when constructed without API key", () => {
    expect(() => new SteamProvider("")).toThrow("STEAM_API_KEY is missing");
  });

  // ── getPlayerSummary ──────────────────────────────────────────────────────

  describe("getPlayerSummary", () => {
    it("returns normalized player data", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          response: {
            players: [
              {
                steamid: "76561198000000000",
                personaname: "TestUser",
                profileurl: "https://steamcommunity.com/id/test",
                avatarfull: "https://example.com/avatar.jpg",
              },
            ],
          },
        }),
      );

      const result = await provider.getPlayerSummary("76561198000000000");
      expect(result?.steamId).toBe("76561198000000000");
      expect(result?.displayName).toBe("TestUser");
    });

    it("returns null when no players returned", async () => {
      mockFetch.mockResolvedValue(makeResponse({ response: { players: [] } }));
      const result = await provider.getPlayerSummary("bad-id");
      expect(result).toBeNull();
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      await expect(provider.getPlayerSummary("id")).rejects.toThrow(
        "Steam API error",
      );
    });

    it("throws on schema validation failure", async () => {
      mockFetch.mockResolvedValue(makeResponse({ unexpected: "shape" }));
      await expect(provider.getPlayerSummary("id")).rejects.toThrow(
        "Steam API returned an unexpected data format",
      );
    });
  });

  // ── getOwnedGames ─────────────────────────────────────────────────────────

  describe("getOwnedGames", () => {
    it("returns normalized game list", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          response: {
            game_count: 1,
            games: [
              {
                appid: 123,
                name: "Halo",
                playtime_forever: 200,
                img_icon_url: "abc",
                rtime_last_played: 1700000000,
              },
            ],
          },
        }),
      );

      const result = await provider.getOwnedGames("steam-id");
      expect(result).toHaveLength(1);
      expect(result[0]!.steamAppId).toBe("123");
      expect(result[0]!.name).toBe("Halo");
      expect(result[0]!.playtimeMinutes).toBe(200);
    });

    it("returns empty array when games field is missing", async () => {
      mockFetch.mockResolvedValue(makeResponse({ response: {} }));
      const result = await provider.getOwnedGames("steam-id");
      expect(result).toEqual([]);
    });

    it("returns null iconUrl when img_icon_url is absent", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          response: {
            games: [{ appid: 1, name: "Game", playtime_forever: 0 }],
          },
        }),
      );
      const result = await provider.getOwnedGames("steam-id");
      expect(result[0]!.iconUrl).toBeNull();
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 503));
      await expect(provider.getOwnedGames("id")).rejects.toThrow(
        "Steam API error",
      );
    });
  });

  // ── getPlayerAchievements ─────────────────────────────────────────────────

  describe("getPlayerAchievements", () => {
    it("returns normalized achievements", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          playerstats: {
            achievements: [
              {
                apiname: "ACH_1",
                achieved: 1,
                unlocktime: 1700000000,
                name: "Win",
              },
              { apiname: "ACH_2", achieved: 0, unlocktime: 0 },
            ],
          },
        }),
      );

      const result = await provider.getPlayerAchievements("steam-id", "123");
      expect(result).toHaveLength(2);
      expect(result![0]!.achieved).toBe(true);
      expect(result![1]!.achieved).toBe(false);
      expect(result![1]!.unlockedAt).toBeNull();
    });

    it("returns null on 400 (game has no stats)", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 400));
      const result = await provider.getPlayerAchievements(
        "steam-id",
        "no-stats-app",
      );
      expect(result).toBeNull();
    });

    it("returns null on 500", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      const result = await provider.getPlayerAchievements("steam-id", "app");
      expect(result).toBeNull();
    });

    it("returns null when achievements array is missing", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({ playerstats: { success: false } }),
      );
      const result = await provider.getPlayerAchievements("steam-id", "app");
      expect(result).toBeNull();
    });
  });
});
