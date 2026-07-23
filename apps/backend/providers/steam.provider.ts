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

/**
 * Low-level wrapper around the Steam Web API, handling authentication,
 * player lookups, game-library fetches, achievement retrieval, and schema
 * resolution.
 *
 * @remarks
 * All authenticated endpoints are accessed via {@link SteamProvider.buildUrl}
 * which injects the API key automatically. Unauthenticated endpoints
 * (e.g. global achievement percentages) construct their own URLs.
 *
 * @example
 * ```ts
 * const steam = new SteamProvider("steam-api-key");
 * const player = await steam.getPlayerSummary("76561198012345678");
 * ```
 */
export class SteamProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.steampowered.com";

  /**
   * Creates a new Steam provider.
   *
   * @param apiKey - Steam Web API key.
   * @throws {Error} When `apiKey` is falsy.
   *
   * @example
   * ```ts
   * const steam = new SteamProvider(process.env.STEAM_API_KEY!);
   * ```
   */
  constructor(apiKey: string) {
    if (!apiKey) throw new Error("STEAM_API_KEY is missing");
    this.apiKey = apiKey;
  }

  /**
   * Builds a fully-qualified URL for an authenticated Steam API endpoint.
   *
   * @remarks
   * The API key is injected as the `key` query parameter automatically.
   * All authenticated methods should use this helper rather than
   * constructing URLs manually.
   *
   * @param path - API path (e.g. `/ISteamUser/GetPlayerSummaries/v0002/`).
   * @param params - Additional query parameters.
   * @returns A `URL` instance ready for fetching.
   */
  private buildUrl(path: string, params: Record<string, string>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("key", this.apiKey);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    return url;
  }

  /**
   * Fetches JSON from a URL with standardised error handling.
   *
   * @remarks
   * Status codes are classified as follows:
   * - `401` / `403` → {@link ProviderAuthError}
   * - `429` → {@link ProviderRateLimitError}
   * - Codes in `toleratedStatuses` → returns `null` (expected, non-fatal)
   * - Other non-2xx → {@link ProviderUnavailableError}
   *
   * @param url - The URL to fetch.
   * @param options - Optional configuration.
   * @param options.toleratedStatuses - HTTP status codes that should be
   *   treated as "no data" rather than failures (e.g. Steam returns `400`
   *   for games with no stats page).
   * @returns Parsed JSON response, or `null` when a tolerated status is
   *   encountered.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} On other non-2xx responses.
   */
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

  /**
   * A non-throwing variant of {@link SteamProvider.fetchJson} for
   * endpoints where failure is non-fatal.
   *
   * @remarks
   * Any error (network, auth, schema) is logged and `null` is returned.
   * Use this for nice-to-have data (e.g. global achievement percentages)
   * rather than required data.
   *
   * @param url - The URL to fetch.
   * @param context - Descriptive label included in the warning message.
   * @returns Parsed JSON response, or `null` when any error occurs.
   */
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

  /**
   * Fetches a Steam player's public profile summary.
   *
   * @param steamId - The 64-bit Steam ID to look up.
   * @returns Profile data, or `null` when no player is found.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} When the response does not match
   *   the expected schema.
   *
   * @example
   * ```ts
   * const player = await steam.getPlayerSummary("76561198012345678");
   * if (player) {
   *   console.log(player.displayName);
   * }
   * ```
   */
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

  /**
   * Fetches a player's full owned-games library.
   *
   * @remarks
   * Games are filtered to only those with `has_community_visible_stats`,
   * which is Steam's signal for "this game has a stats/achievements
   * page." This is a cheap first-pass filter — the definitive check
   * still happens per-game via {@link SteamProvider.getGameSchema}.
   *
   * @param steamId - The 64-bit Steam ID to fetch games for.
   * @returns Array of owned game objects with URLs constructed for icon,
   *   cover, and play-time metadata.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} When the response does not match
   *   the expected schema.
   *
   * @example
   * ```ts
   * const games = await steam.getOwnedGames("76561198012345678");
   * console.log(`${games.length} games with visible stats`);
   * ```
   */
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

  /**
   * Fetches a map of recently-played games and their last-played timestamps.
   *
   * @param steamId - The 64-bit Steam ID to fetch recent activity for.
   * @returns A `Map` from app ID (as string) to last-played `Date`. An
   *   empty map is returned when the API fails or returns no data.
   *
   * @example
   * ```ts
   * const recent = await steam.getRecentlyPlayedGames("76561198012345678");
   * recent.forEach((date, appId) => console.log(`${appId}: ${date}`));
   * ```
   */
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

  /**
   * Fetches a player's achievement progress for a single game.
   *
   * @remarks
   * Steam returns `400` for games with no stats/achievements schema, and
   * `500` for private profiles or profiles that have never launched the
   * game. Both are treated as tolerated (non-fatal) statuses.
   *
   * @param steamId - The 64-bit Steam ID of the player.
   * @param appId - The Steam application ID to fetch achievements for.
   * @returns Array of achievement objects, or `null` when the game has no
   *   stats page or the profile is private.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} On other non-2xx responses that are
   *   not tolerated.
   *
   * @example
   * ```ts
   * const achievements = await steam.getPlayerAchievements(
   *   "76561198012345678",
   *   "730",
   * );
   * if (achievements) {
   *   console.log(`${achievements.length} achievements`);
   * }
   * ```
   */
  async getPlayerAchievements(steamId: string, appId: string) {
    const url = this.buildUrl("/ISteamUserStats/GetPlayerAchievements/v0001/", {
      steamid: steamId,
      appid: appId,
      l: "english",
    });

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

  /**
   * Fetches achievement definitions and global unlock percentages for a
   * single game, merged into a single map.
   *
   * @remarks
   * Two endpoints are called in parallel:
   * - **Schema** (`/GetSchemaForGame/v2/`) — authenticated, returns
   *   achievement names, icons, and hidden flags.
   * - **Global percentages** (`/GetGlobalAchievementPercentagesForApp/v2/`)
   *   — unauthenticated, returns per-achievement unlock rates.
   *
   * Both use {@link SteamProvider.safeFetchJson} so a failure in either
   * is non-fatal; the missing data is simply omitted from the result.
   *
   * @param appId - The Steam application ID to resolve.
   * @returns A `Map` from API name to an object containing `displayName`,
   *   `description`, `hidden`, `iconUrl`, `iconGrayUrl`, and
   *   `globalPercentage`. An empty map is returned when no definitions are
   *   found.
   *
   * @example
   * ```ts
   * const schema = await steam.getGameSchema("730");
   * schema.forEach((meta, apiName) => {
   *   console.log(`${apiName}: ${meta.displayName} (${meta.globalPercentage}%)`);
   * });
   * ```
   */
  async getGameSchema(appId: string) {
    const [schemaData, globalData] = await Promise.all([
      this.safeFetchJson(
        this.buildUrl("/ISteamUserStats/GetSchemaForGame/v2/", {
          appid: appId,
          l: "english",
        }),
        "getGameSchema:schema",
      ),
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
