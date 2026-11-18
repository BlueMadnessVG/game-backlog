import * as v from "valibot";

/**
 * Every failure the backend sends, from middleware/error.handler.ts.
 * `issues` only on VALIDATION_FAILED; `requestId` only on 500 INTERNAL_ERROR.
 */
export const ApiErrorIssueSchema = v.object({
  path: v.optional(v.string()),
  message: v.string(),
});

export const ApiErrorBodySchema = v.object({
  status: v.literal("ERROR"),
  code: v.optional(v.string()),
  message: v.optional(v.string()),
  issues: v.optional(v.array(ApiErrorIssueSchema)),
  requestId: v.optional(v.string()),
});

export type ApiErrorIssue = v.InferOutput<typeof ApiErrorIssueSchema>;
export type ApiErrorBody = v.InferOutput<typeof ApiErrorBodySchema>;
