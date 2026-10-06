import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getCookie } from "hono/cookie";

import { verifyAuthToken } from "../lib/jwt.utils";
import { isApiToken } from "../lib/api-token.utils";
import { SESSION_COOKIE_NAME } from "../lib/session-cookie";
import type { AuthService } from "../modules/auth/auth.services";

/**
 * Which kind of credential authenticated the request.
 *
 * `createAuthMiddleware` sets this on every successful auth path, and on no
 * other path, so an unset value means authentication never ran. Downstream
 * guards (see require-session-credential.middleware.ts) read it to tell a
 * human session apart from a machine credential — `userId` is set
 * identically for both, so `requireAuth` alone cannot make that distinction.
 *
 * - "session"  — a session JWT, i.e. a human login (cookie or Bearer JWT).
 * - "apiToken" — an opaque `bkl_...` token, i.e. a machine/service client.
 */
export type CredentialType = "session" | "apiToken";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    credentialType: CredentialType;
  };
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Builds the auth middleware for a given `AuthService` instance.
 *
 * Still a FACTORY (unchanged from the API-token addition) — every
 * `app.use("*", createAuthMiddleware(authService))` call site is
 * unaffected by this change.
 *
 * Credential resolution, in order:
 *  1. `Authorization: Bearer <token>` header, if present — covers both
 *     opaque API tokens (`bkl_...`, machine clients like achievement-ai)
 *     and any existing Bearer-JWT client. Behavior here is UNCHANGED.
 *  2. Otherwise, the `backlog_session` HttpOnly cookie — the new path,
 *     used by the browser frontend, which no longer handles the token
 *     itself at all.
 *
 * Whichever source the token came from, verification is identical from
 * that point on — a session JWT is a session JWT regardless of how it
 * arrived. The one thing the source DOES determine is `credentialType`,
 * which is recorded here for later guards to read (see CredentialType).
 *
 * CSRF check: when the credential came from the COOKIE (never for
 * Bearer-token requests, which a browser doesn't auto-attach the way it
 * does a cookie) and the request is a mutating method, requires the
 * `X-Request-With` header — already allowlisted in cors.middleware.ts,
 * previously unused. A cross-site <form> submission can't set custom
 * headers, so this blocks the classic CSRF attack shape without a full
 * token-exchange scheme.
 *
 * @throws {HTTPException} 401 when no credential is present or it's
 *   invalid/expired/revoked; 403 when the CSRF header check fails.
 */
export function createAuthMiddleware(authService: AuthService) {
  return createMiddleware<Env>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

    const token = bearerToken ?? sessionCookie;
    const usedCookie = !bearerToken && !!sessionCookie;

    if (!token) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authorization required",
      });
    }

    if (usedCookie && MUTATING_METHODS.has(c.req.method)) {
      if (!c.req.header("X-Request-With")) {
        throw new HTTPException(403, {
          message: "CSRF_CHECK_FAILED: Missing required header",
        });
      }
    }

    if (isApiToken(token)) {
      const result = await authService.verifyApiToken(token);

      if (!result) {
        throw new HTTPException(401, {
          message: "SIGNAL_LOST: Invalid, expired, or revoked API token",
        });
      }

      c.set("userId", result.userId);
      c.set("credentialType", "apiToken");
      await next();
      return;
    }

    try {
      const payload = await verifyAuthToken(token);

      if (!payload.sub || !payload.email) {
        throw new Error("Incomplete payload");
      }

      c.set("userId", payload.sub);
      c.set("userEmail", payload.email);
      c.set("credentialType", "session");

      await next();
    } catch (error) {
      console.error("[Auth] Token validation failed:", error);
      throw new HTTPException(401, {
        message: "SIGNAL_LOST: Invalid or expired session",
      });
    }
  });
}
