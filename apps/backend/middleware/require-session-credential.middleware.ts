import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { CredentialType } from "./auth.middleware";

type Env = {
  Variables: {
    userId: string;
    credentialType: CredentialType;
  };
};

/**
 * Authorization gate for actions that may only be performed through a human
 * session. MUST be mounted AFTER `createAuthMiddleware`, which is what
 * populates `credentialType`.
 *
 * Why this exists: both credential kinds set `userId` identically, so
 * `requireAuth` alone cannot tell a session JWT from a `bkl_...` API token.
 * Without this gate a single leaked API token could call createApiToken and
 * mint a fresh token for the same user — a self-perpetuating credential.
 * Revoking the leaked token would then not evict the child it created,
 * because nothing links a token back to the credential that issued it.
 *
 * Deliberately 403, not 401: the credential IS valid, the ACTION is
 * forbidden. A 401 would send a legitimate machine client back down a
 * re-authenticate loop that could never succeed — re-authenticating with the
 * same API token yields the same result — and would mask the real cause as
 * an expired/invalid session.
 *
 * Fails closed: `credentialType` is only ever set on a successful auth path
 * (see auth.middleware.ts), so an absent value means the auth middleware
 * never ran. That is a wiring bug, read the same way
 * require-admin.middleware.ts reads a missing userId.
 *
 * @throws {HTTPException} 401 when `userId`/`credentialType` are absent
 *   (auth middleware not mounted); 403 when the caller authenticated with
 *   an API token rather than a session.
 */
export function createRequireSessionCredentialMiddleware() {
  return createMiddleware<Env>(async (c, next) => {
    const userId = c.get("userId");
    const credentialType = c.get("credentialType");

    if (!userId || !credentialType) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authentication required",
      });
    }

    if (credentialType !== "session") {
      throw new HTTPException(403, {
        message:
          "SESSION_REQUIRED: This action requires a user session; API tokens may read data but cannot mint new credentials",
      });
    }

    await next();
  });
}
