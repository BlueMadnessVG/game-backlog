import * as v from "valibot";

/**
 * Achievement Filter Enum
 * Controls which achievements are visible in the timeline.
 */
export const AchievementFilterSchema = v.picklist([
  "all",
  "unlocked",
  "locked",
]);

/**
 * Achievement Sort Enum
 * Controls the order of achievements in the timeline.
 */
export const AchievementSortSchema = v.picklist([
  "unlock-date",
  "name",
  "rarity",
]);

/**
 * The Core Achievement Schema
 */
export const AchievementSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  externalId: v.string(),
  gameId: v.pipe(v.string(), v.uuid()),

  // Display
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.nullable(v.string()),
  hidden: v.boolean(),

  // Icons
  iconUrl: v.nullable(v.pipe(v.string(), v.url())),
  iconGrayUrl: v.nullable(v.pipe(v.string(), v.url())),

  // Player state
  achieved: v.boolean(),
  unlockedAt: v.nullable(v.pipe(v.string(), v.isoDateTime())),

  // Global rarity — null if Steam doesn't provide it
  globalPercentage: v.nullable(
    v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  ),

  // Sync dates
  addedAt: v.pipe(v.string(), v.isoDateTime()),
  updatedAt: v.pipe(v.string(), v.isoDateTime()),
});

/**
 * Paginated achievements response — mirrors GamesResponseSchema pattern
 */
export const AchievementsResponseSchema = v.object({
  status: v.picklist(["SUCCESS", "ERROR"]),
  meta: v.object({
    total: v.pipe(v.number(), v.integer(), v.minValue(0)),
    limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
    offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
    unlocked: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  data: v.array(AchievementSchema),
});

export type AchievementFilter = v.InferOutput<typeof AchievementFilterSchema>;
export type AchievementSort = v.InferOutput<typeof AchievementSortSchema>;
export type Achievement = v.InferOutput<typeof AchievementSchema>;
export type AchievementsResponse = v.InferOutput<
  typeof AchievementsResponseSchema
>;
