import * as v from "valibot";

/**
 * URL segment of the per-platform routers (`/api/v1/{steam|xbox|psn}`).
 * Note `psn`, whereas a game's `platform` field says `playstation`.
 */
export const PlatformRouteSchema = v.picklist(["steam", "xbox", "psn"]);

/** The platforms a library query can filter on (a subset of PlatformSchema). */
export const LibraryPlatformSchema = v.picklist(["steam", "xbox", "playstation"]);

const nullableString = v.nullish(v.string());

/** Profile returned by POST /steam/sync. */
export const SteamProfileSchema = v.object({
  steamId: v.string(),
  displayName: v.string(),
  avatar: nullableString,
  profileUrl: nullableString,
});

/** Profile returned by POST /xbox/sync. */
export const XboxProfileSchema = v.object({
  xuid: v.string(),
  gamertag: v.string(),
  avatarUrl: nullableString,
  gamerscore: v.nullish(v.number()),
});

/** Profile returned by POST /psn/sync. Never includes the tokens. */
export const PsnProfileSchema = v.object({
  accountId: v.string(),
  onlineId: v.string(),
  avatarUrl: nullableString,
});

export const platformSyncResultSchema = <S extends v.GenericSchema>(profile: S) =>
  v.object({
    profile: v.nullable(profile),
    gamesCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  });

export const SteamSyncResultSchema = platformSyncResultSchema(SteamProfileSchema);
export const XboxSyncResultSchema = platformSyncResultSchema(XboxProfileSchema);
export const PsnSyncResultSchema = platformSyncResultSchema(PsnProfileSchema);

/** POST /library/games/:gameId/achievements/sync */
export const AchievementSyncResultSchema = v.object({
  synced: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type PlatformRoute = v.InferOutput<typeof PlatformRouteSchema>;
export type LibraryPlatform = v.InferOutput<typeof LibraryPlatformSchema>;
export type SteamProfile = v.InferOutput<typeof SteamProfileSchema>;
export type XboxProfile = v.InferOutput<typeof XboxProfileSchema>;
export type PsnProfile = v.InferOutput<typeof PsnProfileSchema>;
export type SteamSyncResult = v.InferOutput<typeof SteamSyncResultSchema>;
export type XboxSyncResult = v.InferOutput<typeof XboxSyncResultSchema>;
export type PsnSyncResult = v.InferOutput<typeof PsnSyncResultSchema>;
export type AchievementSyncResult = v.InferOutput<
  typeof AchievementSyncResultSchema
>;
