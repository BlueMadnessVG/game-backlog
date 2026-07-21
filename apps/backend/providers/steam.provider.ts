import * as v from "valibot";
import {
  SteamAchievementDefinitionsSchema,
  SteamGlobalAchievementSchema,
  SteamOwnedGamesResponseSchema,
  SteamPlayerAchievementsSchema,
  SteamPlayerSchema,
  SteamRecentlyPlayedSchema,
} from "./schemas/steam.schemas";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from "../lib/provider-error.utils";

export class SteamProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.steampowered.com";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("STEAM_API_KEY is missing");
    this.apiKey = apiKey;
  }

  // ── Shared request helpers ─────────────────────────────────────────────

  // Every authenticated Steam endpoint needs the same `key` param —
  // centralizing it here means a new method can't forget to add it.
  private buildUrl(path: string, params: Record<string, string>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("key", this.apiKey);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    return url;
  }

  // Centralizes status handling so every method fails the same way for the
  // same conditions, instead of each one hand-rolling its own checks.
  // `toleratedStatuses` lets a caller mark specific codes as "expected,
  // return null" rather than a real failure — e.g. Steam's 400/500 for
  // private profiles or games with no stats page.
  private async fetchJson(
    url: URL,
    options: { toleratedStatuses?: number[] } = {},
  ): Promise<unknown> {
    const response = await fetch(url.toString());

    if (response.status === 401 || response.status === 403) {
      throw new ProviderAuthError("SteamProvider");
    }
    if (response.status === 429) {
      throw new ProviderRateLimitError("SteamProvider");
    }
    if (options.toleratedStatuses?.includes(response.status)) {
      return null;
    }
    if (!response.ok) {
      throw new ProviderUnavailableError(
        "SteamProvider",
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  }

  // For endpoints where a failure shouldn't be fatal to the caller (global
  // achievement percentages are a nice-to-have, not required data) — logs
  // and returns null instead of throwing, no matter what went wrong.
  private async safeFetchJson(url: URL, context: string): Promise<unknown> {
    try {
      return await this.fetchJson(url);
    } catch (error) {
      console.warn(
        `[SteamProvider] ${context}: fetch failed, continuing with empty data`,
        error,
      );
      return null;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  async getPlayerSummary(steamId: string) {
    const url = this.buildUrl("/ISteamUser/GetPlayerSummaries/v0002/", {
      steamids: steamId,
    });

    const rawData = await this.fetchJson(url);
    const result = v.safeParse(SteamPlayerSchema, rawData);

    if (!result.success) {
      console.error(
        "[SteamProvider][getPlayerSummary] Schema error:",
        JSON.stringify(v.flatten(result.issues).nested, null, 2),
      );
      throw new ProviderUnavailableError(
        "SteamProvider",
        "Player summary response did not match expected schema",
      );
    }

    const player = result.output.response.players[0];
    if (!player) return null;

    return {
      steamId: player.steamid,
      displayName: player.personaname,
      avatar: player.avatarfull,
      profileUrl: player.profileurl,
    };
  }

  async getOwnedGames(steamId: string) {
    const url = this.buildUrl("/IPlayerService/GetOwnedGames/v0001/", {
      steamid: steamId,
      include_appinfo: "true",
      include_played_free_games: "true",
      format: "json",
    });

    const rawData = await this.fetchJson(url);
    const result = v.safeParse(SteamOwnedGamesResponseSchema, rawData);

    if (!result.success) {
      console.error(
        "[SteamProvider][getOwnedGames] Schema error:",
        v.flatten(result.issues),
      );
      throw new ProviderUnavailableError(
        "SteamProvider",
        "Owned games response did not match expected schema",
      );
    }

    const games = result.output.response.games ?? [];

    // has_community_visible_stats is Steam's own signal for "this game has
    // a stats/achievements page." It's not 100% authoritative — some games
    // omit it even with real achievements — so this is a cheap first-pass
    // filter, not the final word. The definitive check still has to happen
    // per-game via getGameSchema(), since that's the only place Steam
    // actually enumerates achievement definitions.
    const withStats = games.filter((g) => g.has_community_visible_stats);

    console.debug(
      `[SteamProvider] getOwnedGames: ${games.length} games → ${withStats.length} with visible stats`,
    );

    return withStats.map((game) => ({
      steamAppId: String(game.appid),
      name: game.name,
      playtimeMinutes: game.playtime_forever,
      iconUrl: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : null,
      coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_600x900.jpg`,
      lastPlayedAt: game.rtime_last_played
        ? new Date(game.rtime_last_played * 1000)
        : null,
    }));
  }

  async getRecentlyPlayedGames(steamId: string): Promise<Map<string, Date>> {
    const url = this.buildUrl("/IPlayerService/GetRecentlyPlayedGames/v0001/", {
      steamid: steamId,
      count: "0",
    });

    const rawData = await this.safeFetchJson(url, "getRecentlyPlayedGames");
    if (rawData === null) return new Map();

    const result = v.safeParse(SteamRecentlyPlayedSchema, rawData);

    if (!result.success) {
      console.error(
        "[SteamProvider][getRecentlyPlayedGames] Schema error:",
        v.flatten(result.issues),
      );
      return new Map();
    }

    return new Map(
      result.output.response.games.map((g) => [
        String(g.appid),
        new Date(g.rtime_last_played * 1000),
      ]),
    );
  }

  async getPlayerAchievements(steamId: string, appId: string) {
    const url = this.buildUrl("/ISteamUserStats/GetPlayerAchievements/v0001/", {
      steamid: steamId,
      appid: appId,
      l: "english",
    });

    // Steam returns 400 for games with no stats/achievements schema, and
    // 500 for private profiles or profiles that have never launched the
    // game. Both are routine "nothing to report" cases, not failures.
    const rawData = await this.fetchJson(url, {
      toleratedStatuses: [400, 500],
    });
    if (rawData === null) return null;

    const result = v.safeParse(SteamPlayerAchievementsSchema, rawData);

    if (!result.success || !result.output.playerstats.achievements) {
      if (!result.success) {
        console.error(
          "[SteamProvider][getPlayerAchievements] Schema error:",
          v.flatten(result.issues),
        );
      }
      return null;
    }

    return result.output.playerstats.achievements.map((a) => ({
      apiName: a.apiname,
      achieved: a.achieved === 1,
      unlockedAt: a.unlocktime > 0 ? new Date(a.unlocktime * 1000) : null,
      name: a.name ?? a.apiname,
      description: a.description ?? null,
    }));
  }

  async getGameSchema(appId: string) {
    const [schemaData, globalData] = await Promise.all([
      this.safeFetchJson(
        this.buildUrl("/ISteamUserStats/GetSchemaForGame/v2/", {
          appid: appId,
          l: "english",
        }),
        "getGameSchema:schema",
      ),
      // No `key` param — this endpoint is unauthenticated, so it bypasses
      // buildUrl rather than forcing an unused param onto it.
      this.safeFetchJson(
        new URL(
          `${this.baseUrl}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`,
        ),
        "getGameSchema:globalPercentages",
      ),
    ]);

    const schemaResult = v.safeParse(
      SteamAchievementDefinitionsSchema,
      schemaData,
    );
    const schemaDefs = schemaResult.success
      ? (schemaResult.output.game.availableGameStats?.achievements ?? [])
      : [];

    if (schemaDefs.length === 0) {
      console.debug(
        `[SteamProvider] getGameSchema(${appId}) — no achievement definitions found`,
      );
    }

    const globalResult = v.safeParse(SteamGlobalAchievementSchema, globalData);
    const globalMap = new Map(
      globalResult.success
        ? globalResult.output.achievementpercentages.achievements.map((a) => [
            a.name,
            a.percent,
          ])
        : [],
    );

    return new Map(
      schemaDefs.map((def) => [
        def.name,
        {
          displayName: def.displayName,
          description: def.description ?? null,
          hidden: def.hidden === 1,
          iconUrl: def.icon,
          iconGrayUrl: def.icongray,
          globalPercentage: globalMap.get(def.name) ?? null,
        },
      ]),
    );
  }
}
