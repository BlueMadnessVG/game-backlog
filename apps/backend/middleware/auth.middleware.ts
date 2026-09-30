import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { verifyAuthToken } from "../lib/jwt.utils";
import { isApiToken, verifyApiToken } from "../lib/api-token.utils";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * Validates the `Authorization: Bearer <token>` header and exposes the
 * authenticated user via `c.get("userId")` / `c.get("userEmail")`.
 *
 * Two credential kinds are accepted, told apart by prefix:
 *  - `bkl_...`   — an opaque API token (lib/api-token.utils.ts), for
 *    machine/service clients (e.g. the achievement-ai assistant).
 *    Verified against a hashed row in the database. NOTE: this path does
 *    not set `userEmail` (no join to `users` — add one here if something
 *    downstream ever actually needs it for a token-authenticated request).
 *  - anything else — the existing session JWT for human logins, verified
 *    exactly as before.
 *
 * Every existing `app.use("*", authMiddleware)` call site is unaffected —
 * this is a drop-in replacement for the same middleware, not a new one to
 * wire up separately.
 *
 * @throws {HTTPException} 401 when the header is missing, or the
 *   credential is invalid/expired/revoked.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
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
    const result = await verifyApiToken(token);

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
