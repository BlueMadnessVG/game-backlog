import * as v from "valibot";

/**
 * Rarity Enum
 * Helps style te timeline
 */
export const RaritySchema = v.picklist([
  "common",
  "rare",
  "ultra-rare",
  "legendary",
]);

/**
 * The Core Achievement Schema
 */
export const AchievementSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  gameId: v.pipe(v.string(), v.uuid()),
  externalId: v.string(),

  title: v.pipe(v.string(), v.minLength(1)),
  description: v.nullable(v.string()),
  iconUrl: v.pipe(v.string(), v.url()),

  // State
  isUnlocked: v.boolean(),
  unlockedAt: v.nullable(v.pipe(v.string(), v.isoDateTime())),

  // Platform-specific metadata
  rarity: RaritySchema,
  globalPercentage: v.nullable(
    v.pipe(v.number(), v.minValue(0), v.minValue(100)),
  ),
  pointValue: v.optional(v.number()),

  isHidden: v.boolean(),
});

export type Rarity = v.InferOutput<typeof RaritySchema>;
export type Achievement = v.InferOutput<typeof AchievementSchema>;
