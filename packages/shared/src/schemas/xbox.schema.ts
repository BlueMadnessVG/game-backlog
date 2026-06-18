import * as v from "valibot";

export const XboxSyncSchema = v.object({
  xuid: v.pipe(
    v.string(),
    v.minLength(1, "XUID is required"),
    v.maxLength(255),
  ),
});

export type XboxSyncInput = v.InferOutput<typeof XboxSyncSchema>;
