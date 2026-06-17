import { settings } from "node:cluster";
import * as v from "valibot";

const XboxSettingSchema = v.object({
  id: v.string(),
  value: v.string(),
});

export const XboxProfileSchema = v.object({
  profileUsers: v.array(
    v.object({
      id: v.string(),
      settings: v.array(XboxSettingSchema),
      isSponsoredUser: v.optional(v.boolean()),
    }),
  ),
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
  title: v.optional(v.array(XboxTitleSchema), []),
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
        mediaAsset: v.optional(
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

export const XboxAchievementResponseSchema = v.object({
  achievements: v.optional(v.array(XboxAchievementSchema), []),
  pagingInfo: v.optional(
    v.object({
      continuationToken: v.nullable(v.string()),
      totalRecords: v.optional(v.number(), 0),
    }),
  ),
});

export const XboxPlayerStatSchema = v.object({
  groups: v.optional(
    v.array(
      v.object({
        name: v.optional(v.string()),
        titleId: v.optional(v.string()),
        stats: v.optional(
          v.array(
            v.object({
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
  statlistscollection: v.optional(
    v.array(
      v.object({
        arrangedSpecs: v.optional(
          v.array(
            v.object({
              name: v.optional(v.string()),
              value: v.optional(v.string()),
            }),
          ),
          [],
        ),
      }),
    ),
    [],
  ),
});
