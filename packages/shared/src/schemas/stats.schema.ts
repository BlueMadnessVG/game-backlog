import * as v from "valibot";

export const PlatformStatsSchema = v.object({
  games: v.pipe(v.number(), v.integer(), v.minValue(0)),
  completionPercentage: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  achievements: v.pipe(v.number(), v.integer(), v.minValue(0)),
  completedGames: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const StatsSchema = v.object({
  total: PlatformStatsSchema,
  breakdown: v.object({
    steam: PlatformStatsSchema,
    xbox: PlatformStatsSchema,
    playstation: PlatformStatsSchema,
  }),
});

export const StatsResponseSchema = v.object({
  status: v.picklist(["SUCCESS", "ERROR"]),
  data: StatsSchema,
});

export type PlatformStats = v.InferOutput<typeof PlatformStatsSchema>;
export type Stats = v.InferOutput<typeof StatsSchema>;
export type StatsResponse = v.InferOutput<typeof StatsResponseSchema>;
