import * as v from "valibot";

// Twitch OAuth client_credentials token exchange response
export const TwitchTokenSchema = v.object({
  access_token: v.string(),
  expires_in: v.number(),
  token_type: v.string(),
});

// IGDB game search result — only the fields we request via Apicalypse
// category: 0=main_game, 1=dlc_addon, 2=expansion, 3=bundle, 4=standalone_expansion,
//           5=mod, 6=episode, 7=season, 8=remake, 9=remaster, etc.
export const IgdbGameSchema = v.object({
  id: v.number(),
  name: v.string(),
  category: v.optional(v.number(), 0),
  cover: v.optional(
    v.object({
      id: v.number(),
      image_id: v.string(),
    }),
  ),
});

export const IgdbGamesResponseSchema = v.array(IgdbGameSchema);

export type IgdbGame = v.InferOutput<typeof IgdbGameSchema>;
