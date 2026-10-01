import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { verifyAuthToken } from "../lib/jwt.utils";
import { isApiToken } from "../lib/api-token.utils";
import type { AuthService } from "../modules/auth/auth.services";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * Builds the auth middleware for a given `AuthService` instance.
 *
 * This is now a FACTORY, not a bare middleware export — it needs
 * `authService.verifyApiToken`, a real DB lookup, so it needs an
 * `AuthService` to call it on. Every existing
 * `app.use("*", authMiddleware)` call site becomes
 * `app.use("*", createAuthMiddleware(authService))`, matching how every
 * controller already receives its services from the composition root
 * rather than importing a singleton.
 *
 * Validates the `Authorization: Bearer <token>` header and exposes the
 * authenticated user via `c.get("userId")` / `c.get("userEmail")`.
 *
 * Two credential kinds, told apart by prefix:
 *  - `bkl_...`  — an opaque API token (lib/api-token.utils.ts), for
 *    machine/service clients (e.g. the achievement-ai assistant).
 *    Verified via `authService.verifyApiToken`. NOTE: this path does not
 *    set `userEmail` (no join to `users` there) — add one in
 *    AuthService.verifyApiToken if something downstream ever needs it.
 *  - anything else — the existing session JWT for human logins, verified
 *    exactly as before.
 *
 * @throws {HTTPException} 401 when the header is missing, or the
 *   credential is invalid/expired/revoked.
 */
export function createAuthMiddleware(authService: AuthService) {
  return createMiddleware<Env>(async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authorization required",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authorization required",
      });
    }

    if (isApiToken(token)) {
      const result = await authService.verifyApiToken(token);

      if (!result) {
        throw new HTTPException(401, {
          message: "SIGNAL_LOST: Invalid, expired, or revoked API token",
        });
      }

      c.set("userId", result.userId);
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

      await next();
    } catch (error) {
      console.error("[Auth] Token validation failed:", error);
      throw new HTTPException(401, {
        message: "SIGNAL_LOST: Invalid or expired session",
      });
    }
  });
}
