import * as v from "valibot";

// Twitch OAuth client_credentials token exchange response
export const TwitchTokenSchema = v.object({
  access_token: v.string(),
  expires_in: v.number(),
  token_type: v.string(),
});

// IGDB game search result — only the fields we request via Apicalypse
export const IgdbGameSchema = v.object({
  id: v.number(),
  name: v.string(),
  cover: v.optional(
    v.object({
      id: v.number(),
      image_id: v.string(),
    }),
  ),
});

export const IgdbGamesResponseSchema = v.array(IgdbGameSchema);
