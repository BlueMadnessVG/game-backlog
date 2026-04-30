import * as v from "valibot";

/**
 * Platform Enum
 * Represents the source of the game data.
 */
export const PlatformSchema = v.picklist([
  "steam",
  "epic",
  "xbox",
  "playstation",
  "gog",
  "manual",
]);

/**
 * Completion Status Enum
 * Helps categorize the game in the backlog.
 */
export const GameStatusSchema = v.picklist([
  "backlog",
  "in-progress",
  "completed",
  "retired",
]);

export const GameSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  externalId: v.string(),
  title: v.pipe(v.string(), v.minLength(1)),
  platform: PlatformSchema,
  status: GameStatusSchema,

  // Visuals
  iconUrl: v.nullable(v.pipe(v.string(), v.url())),
  coverUrl: v.nullable(v.pipe(v.string(), v.url())),
  bannerUrl: v.nullable(v.pipe(v.string(), v.url())),

  // Stats
  playTime: v.pipe(v.number(), v.minValue(0)),
  completionPercentage: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),

  // Dates
  lastPlayedAt: v.nullable(v.pipe(v.string(), v.isoDateTime())),
  addedAt: v.pipe(v.string(), v.isoDateTime()),
  updatedAt: v.pipe(v.string(), v.isoDateTime()),
});

export const PaginationMetaSchema = v.object({
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
  limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
  offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const GamesResponseSchema = v.object({
  status: v.picklist(["SUCCESS", "ERROR"]),
  meta: PaginationMetaSchema,
  data: v.array(GameSchema),
});

export type PaginationMeta = v.InferOutput<typeof PaginationMetaSchema>;
export type GamesResponse = v.InferOutput<typeof GamesResponseSchema>;

export type Platform = v.InferOutput<typeof PlatformSchema>;
export type GameStatus = v.InferOutput<typeof GameStatusSchema>;
export type Game = v.InferOutput<typeof GameSchema>;
