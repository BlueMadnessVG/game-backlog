import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Base class for every error the API knows how to report to a client.
 *
 * A module throws an `AppError` subclass when something expected goes wrong
 * (not found, bad input, a platform being down) and does not decide how it
 * looks over HTTP: `middleware/error.handler.ts` is the one place that turns
 * it into a response. Anything that is NOT an `AppError` is a bug and is
 * reported as a generic 500.
 *
 * `status` and `code` are part of the API: clients branch on `code`, which
 * stays stable even if the message wording changes.
 */
export abstract class AppError extends Error {
  abstract readonly status: ContentfulStatusCode;
  /** Stable, machine-readable, SCREAMING_SNAKE_CASE. */
  abstract readonly code: string;
  /** Extra response headers, e.g. `Retry-After`. */
  readonly headers?: Record<string, string>;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }

  /**
   * What the client is told. Defaults to `message`; override it when the
   * message is internal detail (a provider's raw status line, say) that
   * belongs in the log but not in a response.
   */
  get publicMessage(): string {
    return this.message;
  }
}

export type ValidationIssue = { path: string; message: string };

/** The request's input didn't match its schema. 400. */
export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = "VALIDATION_FAILED";

  constructor(
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
  }
}

/** A thing the caller asked for doesn't exist (for them). 404. */
export class NotFoundError extends AppError {
  readonly status = 404;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
