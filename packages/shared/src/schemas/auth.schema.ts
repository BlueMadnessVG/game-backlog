import * as v from "valibot";

export const OAuthProviderSchema = v.picklist(["google", "discord"]);

export type OAuthProvider = v.InferOutput<typeof OAuthProviderSchema>;

export const OAuthCallbackQuerySchema = v.object({
  code: v.string(),
  state: v.string(),
});
