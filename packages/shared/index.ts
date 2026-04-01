import * as v from 'valibot';

export const GameSchema = v.object({
  id: v.string(),
  title: v.string(),
  platform: v.picklist(['Steam', 'Epic', 'Xbox']),
  completionStatus: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
});

export type Game = v.InferOutput<typeof GameSchema>;