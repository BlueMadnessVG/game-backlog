import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import { verifyAuthToken, type TokenPurpose } from "../lib/jwt.utils";
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
    /** Set only for `bkl_...` credentials — the verified token's scope. */
    tokenScope: string;
    /**
     * Set only for session-JWT credentials. "step_up" iff the JWT carried
     * a `purpose` claim of that name (createAuthMiddleware was built with
     * `allowStepUp: true`). Downstream, POST /auth/api-tokens requires a
     * step-up purpose exactly when the user is TOTP-enrolled.
     */
    tokenPurpose: TokenPurpose;
  };
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Token self-management carve-out: a machine client must always be able to
 * list and revoke ITS OWN tokens — that's the rotation path for a leaked
 * key, and `revokeApiToken` is already scoped to the caller's userId
 * (auth.services.ts), so no cross-user action is possible here. POST is
 * blocked separately by require-session-credential.middleware.ts, so
 * exempting the whole `/auth/api-tokens` path is safe.
 */
function isTokenSelfManagementPath(pathname: string): boolean {
  return pathname.includes("/auth/api-tokens");
}

/**
 * Scope enforcement for API-token credentials, rolled out in two stages so a
 * known `read:library` consumer that currently writes isn't broken cold:
 *
 *  - `ENFORCE_API_TOKEN_SCOPES` unset/false: a scoped-out mutating request
 *    is allowed but logged; from the log line the offending consumer can be
 *    identified and reissued a `write:library` token.
 *  - `ENFORCE_API_TOKEN_SCOPES=true`: the same request is denied with 403.
 *
 * Deliberately central rather than per-route: a new mutating route that
 * forgets to mount a guard is still denied here, so scope can't silently
 * rot. `write:library` is the only scope that permits mutations; anything
 * else is read-only. Reads and token self-management never reach the check.
 */
function enforceApiTokenScope(c: Context<Env>, scope: string): void {
  if (scope === "write:library") return;
  if (!MUTATING_METHODS.has(c.req.method)) return;
  if (isTokenSelfManagementPath(c.req.path)) return;

  const hardened = process.env.ENFORCE_API_TOKEN_SCOPES === "true";

  if (hardened) {
    console.warn(
      `[API_TOKEN_SCOPE] DENIED scope=${scope} ${c.req.method} ${c.req.path} userId=${c.get("userId")}`,
    );
    throw new HTTPException(403, {
      message:
        "SCOPE_DENIED: This API token's scope does not permit this action. Reissue it with scope 'write:library' if the action is legitimate.",
    });
  }

  console.warn(
    `[API_TOKEN_SCOPE] WARN-ONLY scope=${scope} is insufficient for ${c.req.method} ${c.req.path} userId=${c.get("userId")}. Set ENFORCE_API_TOKEN_SCOPES=true to deny these requests.`,
  );
}

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
 * @param opts - `allowStepUp`: accept a `purpose: "step_up"` JWT as a
 *   valid session credential (default false). Only POST /auth/api-tokens
 *   opts in — everywhere else a step-up token is rejected by
 *   verifyAuthToken's purpose check, so a leaked step-up token can't be
 *   replayed as a general session.
 * @throws {HTTPException} 401 when no credential is present or it's
 *   invalid/expired/revoked; 403 when the CSRF header check fails or when
 *   an API token's scope forbids a mutating request (only when
 *   ENFORCE_API_TOKEN_SCOPES=true).
 */
export function createAuthMiddleware(
  authService: AuthService,
  opts?: { allowStepUp?: boolean },
) {
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
      c.set("tokenScope", result.scope);
      enforceApiTokenScope(c, result.scope);
      await next();
      return;
    }

    try {
      const payload = await verifyAuthToken(
        token,
        opts?.allowStepUp
          ? { allowPurpose: ["session", "step_up"] }
          : undefined,
      );

      if (!payload.sub || !payload.email) {
        throw new Error("Incomplete payload");
      }

      c.set("userId", payload.sub);
      c.set("userEmail", payload.email);
      c.set("credentialType", "session");
      c.set("tokenPurpose", (payload.purpose ?? "session") as TokenPurpose);

      await next();
    } catch (error) {
      console.error("[Auth] Token validation failed:", error);
      throw new HTTPException(401, {
        message: "SIGNAL_LOST: Invalid or expired session",
      });
    }
  });
}
