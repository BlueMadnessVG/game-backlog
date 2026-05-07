import * as v from "valibot";

export const SteamPlayerSchema = v.object({
  response: v.object({
    players: v.array(
      v.object({
        steamid: v.string(),
        personaname: v.string(),
        profileurl: v.string(),
        avatarfull: v.string(),
        lastlogoff: v.optional(v.number()),
        realname: v.optional(v.string()),
        timecreated: v.optional(v.number()),
      }),
    ),
  }),
});

export const SteamOwnedGamesResponse = v.object({
  response: v.object({
    game_count: v.optional(v.number(), 0),
    games: v.optional(
      v.array(
        v.object({
          appid: v.number(),
          name: v.string(),
          playtime_forever: v.number(),
          img_icon_url: v.optional(v.string()),
          has_community_visible_stats: v.optional(v.boolean()),
          rtime_last_played: v.optional(v.number(), 0),
        }),
      ),
      [],
    ),
  }),
});

export const SteamRecentlyPlayedSchema = v.object({
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

export const SteamPlayerAchievementsSchema = v.object({
  playerstats: v.object({
    steamID: v.optional(v.string()),
    gameName: v.optional(v.string()),
    achievements: v.optional(
      v.array(
        v.object({
          apiname: v.string(),
          achieved: v.number(),
          unlocktime: v.number(),
          name: v.optional(v.string()),
          description: v.optional(v.string()),
        }),
      ),
    ),
    success: v.optional(v.boolean()),
  }),
});

export const SteamGameSchemaSchema = v.object({
  game: v.object({
    availableGameStats: v.optional(
      v.object({
        achievements: v.optional(
          v.array(
            v.object({
              name: v.string(),
              displayName: v.string(),
              hidden: v.number(),
              description: v.optional(v.string()),
              icon: v.string(),
              icongray: v.string(),
            }),
          ),
        ),
      }),
    ),
  }),
});

export const SteamGlobalAchievementSchema = v.object({
  achievementpercentages: v.object({
    achievements: v.optional(
      v.array(
        v.object({
          name: v.string(),
          percent: v.number(),
        }),
      ),
      [],
    ),
  }),
});
