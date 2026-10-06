import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";

import type { DbClient } from "../db";
import { users } from "../db/schema";

/**
 * Authorization gate for admin-only routes. MUST be mounted AFTER
 * `createAuthMiddleware`, which is what populates `userId`.
 *
 * Deliberately queries the DB instead of reading a role off the session JWT:
 * sessions live 7 days (see lib/session-cookie.ts), so a claim-embedded role
 * would keep a demoted admin privileged until their token expired. One
 * indexed primary-key read, on a route that is by definition rare, is the
 * right trade — and it means a role change in the DB takes effect on the very
 * next request with no re-login.
 *
 * Works for both credential kinds for free: `createAuthMiddleware` sets
 * `userId` identically for session JWTs and opaque `bkl_...` API tokens, so a
 * third-party machine client passes through the same gate.
 *
 * @throws {HTTPException} 401 when `userId` is absent (i.e. the auth
 *   middleware was never mounted — a wiring bug, so it fails closed rather
 *   than throwing on an undefined context variable); 403 when the caller is
 *   authenticated but not an admin.
 */
export function createRequireAdminMiddleware(db: DbClient) {
  return createMiddleware<{ Variables: { userId: string } }>(async (c, next) => {
    const userId = c.get("userId");

    if (!userId) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authentication required",
      });
    }

    const rows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (rows[0]?.role !== "admin") {
      throw new HTTPException(403, {
        message: "ACCESS_DENIED: Administrator role required",
      });
    }

    await next();
  });
}