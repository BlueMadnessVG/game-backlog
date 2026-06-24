import * as v from "valibot";

export const PsnSyncSchema = v.object({
  npsso: v.pipe(
    v.string(),
    v.minLength(1, "NPSSO token is required"),
    v.maxLength(64),
  ),
});

export type PsnSyncInput = v.InferOutput<typeof PsnSyncSchema>;
