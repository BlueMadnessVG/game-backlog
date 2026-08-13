import * as v from "valibot";

/**
 * Valibot schemas for the IGDB provider's two call shapes.
 *
 * Exports:
 *  - TwitchTokenSchema: the app-access-token response IGDB requires for auth.
 *  - IgdbGameSchema + IgdbGamesResponseSchema: game search / cover lookups.
 *    `category`, `parent_game` and `version_parent` are captured so the
 *    enrichment step can filter out DLC, editions and parent re-releases
 *    that would pollute the catalog with duplicate rows.
 *  - IgdbGame / IgdbGamesResponse: inferred output types.
 */
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

export type IgdbGamesResponse = v.InferOutput<typeof IgdbGamesResponseSchema>;
export type IgdbGame = v.InferOutput<typeof IgdbGameSchema>;
