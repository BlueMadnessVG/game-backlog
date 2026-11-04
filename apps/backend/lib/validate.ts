import { vValidator } from "@hono/valibot-validator";

import { ValidationError } from "./errors";

/**
 * `vValidator` with this API's error contract: input that doesn't match the
 * schema becomes a {@link ValidationError} (400 `VALIDATION_FAILED`, the
 * first problem as the message, every problem in `issues`) instead of the
 * validator's own response shape.
 *
 * Use it exactly like `vValidator`; handlers still read the parsed input with
 * `c.req.valid(target)` and keep full type inference.
 */
export const validate = ((target, schema, hook) =>
  vValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issues = result.issues.map((issue) => ({
        path: (issue.path ?? []).map((segment) => String(segment.key)).join("."),
        message: issue.message,
      }));
      throw new ValidationError(issues[0]?.message ?? "Invalid input", issues);
    }
    return hook?.(result, c);
  })) as typeof vValidator;
