import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SteamProvider } from "../steam.provider";
import { ProviderUnavailableError } from "../../lib/provider-error.utils";

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

    it("throws ProviderUnavailableError on HTTP error", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      await expect(provider.getPlayerSummary("id")).rejects.toThrow(
        ProviderUnavailableError,
      );
    });

    it("throws ProviderUnavailableError on schema validation failure", async () => {
      mockFetch.mockResolvedValue(makeResponse({ unexpected: "shape" }));
      await expect(provider.getPlayerSummary("id")).rejects.toThrow(
        ProviderUnavailableError,
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
                has_community_visible_stats: true,
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

    // Games without community stats can't have achievements, so they are
    // left out of the library on purpose.
    it("drops games that have no community-visible stats", async () => {
      mockFetch.mockResolvedValue(
        makeResponse({
          response: {
            games: [
              { appid: 1, name: "With", playtime_forever: 1, has_community_visible_stats: true },
              { appid: 2, name: "Without", playtime_forever: 1, has_community_visible_stats: false },
              { appid: 3, name: "Unspecified", playtime_forever: 1 },
            ],
          },
        }),
      );

      const result = await provider.getOwnedGames("steam-id");

      expect(result.map((g) => g.name)).toEqual(["With"]);
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
            games: [
              {
                appid: 1,
                name: "Game",
                playtime_forever: 0,
                has_community_visible_stats: true,
              },
            ],
          },
        }),
      );
      const result = await provider.getOwnedGames("steam-id");
      expect(result[0]!.iconUrl).toBeNull();
    });

    it("throws ProviderUnavailableError on HTTP error", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 503));
      await expect(provider.getOwnedGames("id")).rejects.toThrow(
        ProviderUnavailableError,
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

  // ── getGameSchema ─────────────────────────────────────────────────────────

  describe("getGameSchema", () => {
    const definition = (name: string) => ({
      name,
      displayName: `Display ${name}`,
      hidden: 0,
      description: `About ${name}`,
      icon: `https://img/${name}.jpg`,
      icongray: `https://img/${name}_gray.jpg`,
    });

    const schemaBody = (names: string[]) => ({
      game: { availableGameStats: { achievements: names.map(definition) } },
    });

    const globalBody = (entries: Record<string, number>) => ({
      achievementpercentages: {
        achievements: Object.entries(entries).map(([name, percent]) => ({
          name,
          percent,
        })),
      },
    });

    /** Answers the two parallel requests getGameSchema makes, by URL. */
    const respondWith = (
      schema: () => unknown,
      global: () => unknown = () => makeResponse(globalBody({})),
    ) => {
      mockFetch.mockImplementation(async (url: string) =>
        url.includes("GetSchemaForGame") ? schema() : global(),
      );
    };

    it("returns the definitions merged with global percentages", async () => {
      respondWith(
        () => makeResponse(schemaBody(["ACH_A", "ACH_B"])),
        () => makeResponse(globalBody({ ACH_A: 12.5 })),
      );

      const result = await provider.getGameSchema("730");

      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.schema.size).toBe(2);
      expect(result.schema.get("ACH_A")).toMatchObject({
        displayName: "Display ACH_A",
        hidden: false,
        globalPercentage: 12.5,
      });
      expect(result.schema.get("ACH_B")?.globalPercentage).toBeNull();
    });

    it("still returns the definitions when only the percentages fail", async () => {
      respondWith(
        () => makeResponse(schemaBody(["ACH_A"])),
        () => makeResponse({}, 500),
      );

      const result = await provider.getGameSchema("730");

      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.schema.get("ACH_A")?.globalPercentage).toBeNull();
    });

    it.each([
      ["no stats section", { game: {} }],
      ["an empty list", { game: { availableGameStats: { achievements: [] } } }],
      ["stats without achievements", { game: { availableGameStats: {} } }],
    ])("reports 'empty' when Steam answers with %s", async (_name, body) => {
      respondWith(() => makeResponse(body));

      expect(await provider.getGameSchema("1")).toEqual({ status: "empty" });
    });

    // The bug this distinction fixes: a failed request used to look exactly
    // like "no achievements", and that made the sync delete the game.
    it.each([
      ["HTTP 500", () => makeResponse({}, 500)],
      ["HTTP 429 (rate limited)", () => makeResponse({}, 429)],
      ["HTTP 403", () => makeResponse({}, 403)],
      ["a payload that doesn't match the schema", () => makeResponse({ nope: 1 })],
    ])("reports 'error', not 'empty', on %s", async (_name, response) => {
      respondWith(response);

      expect(await provider.getGameSchema("1")).toEqual({ status: "error" });
    });

    it("reports 'error' when the request itself fails (network)", async () => {
      respondWith(() => {
        throw new Error("ECONNRESET");
      });

      expect(await provider.getGameSchema("1")).toEqual({ status: "error" });
    });
  });
});
