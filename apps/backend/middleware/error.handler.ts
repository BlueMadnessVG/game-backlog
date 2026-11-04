import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { AppError, NotFoundError, ValidationError } from "../lib/errors";

/**
 * The one place that turns an error into an HTTP response.
 *
 * Every error leaves the API in the same JSON shape:
 *
 *     { "status": "ERROR", "code": "GAME_NOT_FOUND", "message": "…" }
 *
 * `code` is stable and meant for clients to branch on; `message` is for
 * people. Where it comes from:
 *  - {@link AppError}: an error a module threw on purpose. It brings its own
 *    status, code and client-safe message.
 *  - `HTTPException`: thrown by middleware (auth, locks, timeouts). Same
 *    status as before, now JSON, with the code taken from its message.
 *  - anything else is a bug: a generic 500 that never leaks the real message
 *    (outside development) and carries the request id so a report can be
 *    matched to its log line.
 *
 * Only server-side failures are logged here; a 404 or a bad password is
 * the caller's doing, not an incident.
 */

type Body = {
  code: string;
  message: string;
  issues?: ValidationError["issues"];
  requestId?: string;
};

const respond = (
  c: Context,
  status: ContentfulStatusCode,
  body: Body,
  headers?: Record<string, string>,
) => c.json({ status: "ERROR" as const, ...body }, status, headers);

const logServerError = (c: Context, err: unknown) => {
  console.error(
    `[SERVER ERROR] ${c.req.method} ${c.req.path} requestId=${c.get("requestId") ?? "-"}`,
    err,
  );
};

/** Codes for HTTPExceptions whose message doesn't carry one. */
const STATUS_CODES: Partial<Record<number, string>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  408: "REQUEST_TIMEOUT",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
};

/** Sentences for HTTPExceptions that throw only a bare code. */
const BARE_CODE_MESSAGES: Record<string, string> = {
  SYNC_IN_PROGRESS: "A sync is already in progress. Try again in a moment.",
};

const CODE = /^[A-Z][A-Z0-9_]+$/;

/**
 * Middleware throws HTTPExceptions whose message is either `CODE: sentence`
 * (auth.middleware.ts, credential-policy.middleware.ts), a bare `CODE`
 * (the advisory lock), or plain words (Hono itself).
 */
function describeHttpException(err: HTTPException): Pick<Body, "code" | "message"> {
  const prefixed = err.message.match(/^([A-Z][A-Z0-9_]+):\s*([\s\S]*)$/);
  if (prefixed) {
    return { code: prefixed[1]!, message: prefixed[2] || prefixed[1]! };
  }
  if (CODE.test(err.message)) {
    return {
      code: err.message,
      message: BARE_CODE_MESSAGES[err.message] ?? err.message.replace(/_/g, " ").toLowerCase(),
    };
  }
  return {
    code: STATUS_CODES[err.status] ?? `HTTP_${err.status}`,
    message: err.message || `Request failed (${err.status})`,
  };
}

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logServerError(c, err);

    return respond(
      c,
      err.status,
      {
        code: err.code,
        message: err.publicMessage,
        ...(err instanceof ValidationError && { issues: err.issues }),
      },
      err.headers,
    );
  }

  if (err instanceof HTTPException) {
    // An exception that carries its own Response (e.g. a WWW-Authenticate
    // challenge) is passed through untouched.
    if (err.res) return err.getResponse();

    if (err.status >= 500) logServerError(c, err);
    return respond(c, err.status, describeHttpException(err));
  }

  logServerError(c, err);
  return respond(c, 500, {
    code: "INTERNAL_ERROR",
    message:
      process.env.APP_ENV === "development" ? err.message : "Unknown Error",
    requestId: c.get("requestId"),
  });
};

/** Unknown routes, in the same shape as every other error. */
export const notFoundHandler = (c: Context) =>
  errorHandler(new NotFoundError("ROUTE_NOT_FOUND", "Route not found"), c);
