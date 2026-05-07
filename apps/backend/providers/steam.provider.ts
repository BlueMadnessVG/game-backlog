import * as v from "valibot";
import {
  SteamGameSchemaSchema,
  SteamGlobalAchievementSchema,
  SteamOwnedGamesResponse,
  SteamPlayerAchievementsSchema,
  SteamPlayerSchema,
  SteamRecentlyPlayedSchema,
} from "./schemas/steam.schemas";

export class SteamProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.steampowered.com";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("STEAM_API_KEY is missing");
    this.apiKey = apiKey;
  }

  async getPlayerSummary(steamId: string) {
    const url = new URL(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`);
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("steamids", steamId);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Steam API error: ${response.statusText}`);
      }

      const rawData = await response.json();
      const result = v.safeParse(SteamPlayerSchema, rawData);

      if (!result.success) {
        console.error(
          "❌ Valibot Schema Error:",
          JSON.stringify(v.flatten(result.issues).nested, null, 2),
        );
        throw new Error("Steam API returned an unexpected data format");
      }

      const player = result.output.response.players[0];

      if (!player) {
        return null;
      }

      return {
        steamId: player.steamid,
        displayName: player.personaname,
        avatar: player.avatarfull,
        profileUrl: player.profileurl,
      };
    } catch (error) {
      console.error(
        `[SteamProvider][getPlayerSummary] Failed for ID: ${steamId}`,
        error,
      );
      throw error;
    }
  }

  async getOwnedGames(steamId: string) {
    const url = new URL(`${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/`);
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("steamid", steamId);
    url.searchParams.append("include_appinfo", "true");
    url.searchParams.append("include_played_free_games", "true");
    url.searchParams.append("format", "json");

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Steam API error: ${response.statusText}`);
      }

      const rawData = await response.json();
      const result = v.safeParse(SteamOwnedGamesResponse, rawData);

      if (!result.success) {
        console.error(v.flatten(result.issues));
        throw new Error("Steam API Data Validation Failed");
      }

      const games = result.output.response.games ?? [];

      return games.map((game) => ({
        steamAppId: String(game.appid),
        name: game.name,
        playtimeMinutes: game.playtime_forever,
        iconUrl: game.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
          : null,
        coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_600x900.jpg`,
        lastPlayedAt: game.rtime_last_played // <-- add this
          ? new Date(game.rtime_last_played * 1000)
          : null,
      }));
    } catch (error) {
      console.error(
        `[SteamProvider] Failed to fetch games for ${steamId}:`,
        error,
      );
      throw error;
    }
  }

  async getRecentlyPlayedGames(steamId: string) {
    const url = new URL(
      `${this.baseUrl}/IPlayerService/GetRecentlyPlayedGames/v0001/`,
    );
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("steamid", steamId);
    url.searchParams.append("count", "0");

    const response = await fetch(url.toString());
    if (!response.ok)
      throw new Error(`Steam API error: ${response.statusText}`);

    const rawData = await response.json();
    const result = v.safeParse(SteamRecentlyPlayedSchema, rawData);

    if (!result.success) {
      console.error(
        "[SteamProvider] RecentlyPlayed schema error",
        v.flatten(result.issues),
      );
      return new Map<string, Date>();
    }
    return new Map(
      result.output.response.games.map((g) => [
        String(g.appid),
        new Date(g.rtime_last_played * 1000),
      ]),
    );
  }

  async getPlayerAchievements(steamId: string, appId: string) {
    const url = new URL(
      `${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`,
    );
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("steamid", steamId);
    url.searchParams.append("appid", appId);
    url.searchParams.append("l", "english");

    const response = await fetch(url.toString());

    if (response.status === 400 || response.status === 500) return null;
    if (!response.ok)
      throw new Error(`Steam API error: ${response.statusText}`);

    const rawData = await response.json();
    const result = v.safeParse(SteamPlayerAchievementsSchema, rawData);

    if (!result.success || !result.output.playerstats.achievements) {
      if (!result.success) {
        console.error(
          "[SteamProvider] PlayerAchievements schema error",
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
    const [schemaRes, globalRes] = await Promise.all([
      fetch(
        `${this.baseUrl}/ISteamUserStats/GetSchemaForGame/v2/?key=${this.apiKey}&appid=${appId}&l=english`,
      ),
      fetch(
        `${this.baseUrl}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`,
      ),
    ]);

    const schemaData = await schemaRes.json();
    const schemaResult = v.safeParse(SteamGameSchemaSchema, schemaData);
    const schemaDefs = schemaResult.success
      ? (schemaResult.output.game.availableGameStats?.achievements ?? [])
      : [];

    const globalData = await globalRes.json();
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
