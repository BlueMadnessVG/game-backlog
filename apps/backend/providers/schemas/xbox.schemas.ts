import * as v from "valibot";

/**
 * Valibot schemas for the OpenXBL API responses consumed by the provider.
 *
 * Every OpenXBL response is wrapped in an envelope of the shape
 * `{ content: { ... }, code: number }`, so each schema mirrors that wrapper
 * and the provider checks `code` (a non-2xx HTTP status throws earlier).
 *
 * Exports:
 *  - XboxProfileSchema: GetPlayer profile (profileUsers + settings array).
 *  - XboxTitleHistorySchema: GetTitleHistory library rows (titleId, name,
 *    displayImage, achievement progress, lastTimePlayed).
 *  - XboxAchievementsResponseSchema: GetAchievements (achievements array +
 *    pagingInfo.totalRecords — the provider uses this to detect truncated
 *    responses).
 *  - XboxPlayerStatSchema: GetPlayerStats playtime collection. Note the
 *    stat `titleid` field is lowercase (not camelCase) and `value` is
 *    omitted when no playtime was recorded.
 */
const XboxSettingSchema = v.object({
  id: v.string(),
  value: v.string(),
});

const XboxProfileUserSchema = v.object({
  id: v.string(),
  hostId: v.optional(v.string()),
  settings: v.array(XboxSettingSchema),
  isSponsoredUser: v.optional(v.boolean()),
});

export const XboxProfileSchema = v.object({
  content: v.object({
    profileUsers: v.array(XboxProfileUserSchema),
  }),
  code: v.optional(v.number()),
});

export const XboxTitleSchema = v.object({
  titleId: v.string(),
  name: v.string(),
  displayImage: v.optional(v.string()),
  achievement: v.optional(
    v.object({
      currentAchievements: v.optional(v.number(), 0),
      totalAchievements: v.optional(v.number(), 0),
      currentGamerscore: v.optional(v.number(), 0),
      totalGamerscore: v.optional(v.number(), 0),
      progressPercentage: v.optional(v.number(), 0),
    }),
  ),
  titleHistory: v.optional(
    v.object({
      lastTimePlayed: v.optional(v.string()),
      visible: v.optional(v.boolean()),
    }),
  ),
});

export const XboxTitleHistorySchema = v.object({
  content: v.object({
    titles: v.optional(v.array(XboxTitleSchema), []),
  }),
  code: v.optional(v.number()),
});

export const XboxAchievementSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  lockedDescription: v.optional(v.string()),
  isSecret: v.optional(v.boolean(), false),
  rewards: v.optional(
    v.array(
      v.object({
        type: v.optional(v.string()),
        value: v.optional(v.string()),
        mediaAsset: v.nullish(
          v.object({
            url: v.optional(v.string()),
            type: v.optional(v.string()),
          }),
        ),
      }),
    ),
    [],
  ),
  progression: v.optional(
    v.object({
      timeUnlocked: v.optional(v.string(), ""),
    }),
  ),
  rarity: v.optional(
    v.object({
      currentPercentage: v.optional(v.number()),
    }),
  ),
});

export const XboxAchievementsResponseSchema = v.object({
  content: v.object({
    achievements: v.optional(v.array(XboxAchievementSchema), []),
    pagingInfo: v.optional(
      v.object({
        continuationToken: v.nullable(v.string()),
        totalRecords: v.optional(v.number(), 0),
      }),
    ),
  }),
  code: v.optional(v.number()),
});

export const XboxPlayerStatSchema = v.object({
  content: v.object({
    statlistscollection: v.optional(
      v.array(
        v.object({
          arrangebyfield: v.optional(v.string()),
          arrangebyfieldid: v.optional(v.string()),
          stats: v.optional(
            v.array(
              v.object({
                titleid: v.optional(v.string()),
                name: v.string(),
                value: v.optional(v.string()),
                type: v.optional(v.string()),
              }),
            ),
            [],
          ),
        }),
      ),
      [],
    ),
  }),
  code: v.optional(v.number()),
});
