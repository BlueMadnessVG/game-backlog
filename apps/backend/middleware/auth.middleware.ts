import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { verifyAuthToken } from "../lib/jwt.utils";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * Validates the `Authorization: Bearer <jwt>` header and exposes the
 * authenticated user via `c.get("userId")` / `c.get("userEmail")`.
 *
 * Tokens are issued by AuthService and signed with the shared JWT_SECRET.
 *
 * @throws {HTTPException} 401 when the header is missing or the token is
 *   invalid/expired.
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
