import * as v from "valibot";

export const SteamSyncSchema = v.object({
  steamId: v.pipe(
    v.string(),
    v.minLength(17, "Steam ID must be 17 characters"),
    v.maxLength(17),
  ),
});

export type SteamSyncInput = v.InferOutput<typeof SteamSyncSchema>;
