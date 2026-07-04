import * as v from "valibot";

export const TwitchTokenSchema = v.object({
  access_token: v.string(),
  expires_in: v.number(),
  token_type: v.string(),
});

export const IgdbGameSchema = v.object({
  name: v.string(),
  category: v.optional(v.number(), 0),
  cover: v.optional(v.object({ image_id: v.string() })),
  parent_game: v.optional(v.number()),
  version_parent: v.optional(v.number()),
  total_rating_count: v.optional(v.number()),
  first_release_date: v.optional(v.number()),
});

export const IgdbGamesResponseSchema = v.array(IgdbGameSchema);

export type IgdbGame = v.InferOutput<typeof IgdbGameSchema>;
