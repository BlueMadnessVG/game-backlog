import * as v from "valibot";

export const PsnSyncSchema = v.object({
  npsso: v.pipe(
    v.string(),
    v.minLength(1, "NPSSO token is required"),
    v.maxLength(64),
  ),
  onlineId: v.pipe(
    v.string(),
    v.minLength(3, "PSN online ID is required"),
    v.maxLength(16),
  ),
});

export type PsnSyncInput = v.InferOutput<typeof PsnSyncSchema>;
