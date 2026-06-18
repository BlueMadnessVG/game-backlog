import * as v from "valibot";

const XboxSettingSchema = v.object({
  id: v.string(),
  value: v.string(),
});

// ✅ All OpenXBL responses are wrapped: { content: { ... }, code: number }
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

// Title history uses the same envelope
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

// Achievements response — add the same envelope to be safe
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
                titleid: v.optional(v.string()), // ✅ lowercase, not camelCase
                name: v.string(),
                value: v.optional(v.string()), // missing = no playtime recorded
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
