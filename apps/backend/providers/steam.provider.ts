import * as v from "valibot";

const SteamPlayerSchema = v.object({
  response: v.object({
    players: v.array(
      v.object({
        steamid: v.string(),
        personaname: v.string(),
        profileurl: v.string(),
        avatarfull: v.string(),
        // Use v.optional for fields that might be missing
        lastlogoff: v.optional(v.number()),
        // You can also add other fields as optional if you want to use them later
        realname: v.optional(v.string()),
        timecreated: v.optional(v.number()),
      }),
    ),
  }),
});

const SteamOwnedGamesResponse = v.object({
  response: v.object({
    game_count: v.optional(v.number(), 0), // Sometimes missing if 0
    games: v.optional(
      v.array(
        // MUST be v.array
        v.object({
          appid: v.number(),
          name: v.string(),
          playtime_forever: v.number(),
          img_icon_url: v.optional(v.string()), // Optional because some games lack icons
          has_community_visible_stats: v.optional(v.boolean()),
          rtime_last_played: v.optional(v.number(), 0),
        }),
      ),
      [],
    ),
  }),
});

const SteamRecentlyPlayedSchema = v.object({
  response: v.object({
    total_count: v.optional(v.number(), 0),
    games: v.optional(
      v.array(
        v.object({
          appid: v.number(),
          rtime_last_played: v.number(),
        }),
      ),
      [],
    ),
  }),
});

const SteamAchievementsSchema = v.object({
  playerstats: v.object({
    // Steam returns this field absent (not just empty) when a game has no achievements,
    // so we need to handle both cases
    achievements: v.optional(
      v.array(
        v.object({
          achieved: v.number(), // 1 = achieved, 0 = not
        }),
      ),
    ),
  }),
});

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
    url.searchParams.append("count", "0"); // 0 = return all (up to 500)

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

  async getGameAchievements(steamId: string, appId: string) {
    const url = new URL(
      `${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`,
    );
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("steamid", steamId);
    url.searchParams.append("appid", appId);

    const response = await fetch(url.toString());

    // Steam returns 400 when a game has no achievement system at all
    if (response.status === 400 || response.status === 500) return null;
    if (!response.ok)
      throw new Error(`Steam API error: ${response.statusText}`);

    const rawData = await response.json();
    const result = v.safeParse(SteamAchievementsSchema, rawData);

    if (!result.success || !result.output.playerstats.achievements) {
      return null; // game has no achievements
    }

    const achievements = result.output.playerstats.achievements;
    const total = achievements.length;
    const achieved = achievements.filter((a) => a.achieved === 1).length;

    return {
      completionPercentage: total > 0 ? (achieved / total) * 100 : 0,
      achievedCount: achieved,
      totalCount: total,
    };
  }
}
