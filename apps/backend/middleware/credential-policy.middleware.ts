import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { AuthService } from "../modules/auth/auth.services";
import { createAuthMiddleware, type AuthEnv } from "./auth.middleware";

/**
 * What a route demands of the caller's credential. One declaration per route
 * replaces the old split between a route-specific auth middleware, a separate
 * session-only gate, and an inline step-up check in the handler.
 */
export type CredentialPolicy = {
  /**
   * "session" rejects `bkl_...` API tokens with 403. Use it for anything that
   * creates or alters credentials: a leaked API token must never be able to
   * renew itself or take over the account's second factor.
   * "any" accepts a session or an API token.
   */
  credential: "any" | "session";
  /**
   * "if-enrolled": a user who has enrolled TOTP must present a
   * `purpose: "step_up"` JWT (from POST /auth/step-up); a user who hasn't has
   * nothing to prove and passes on a plain session. Also makes the route
   * accept step-up JWTs, which every other route rejects.
   * "never" (default): step-up JWTs are rejected, as everywhere else.
   */
  stepUp?: "never" | "if-enrolled";
};

/**
 * Authenticates the request and enforces `policy`, in that order, so the rule
 * for "who may do this" lives in one place.
 *
 * Authentication runs first with a no-op continuation, and the policy checks
 * run after it returns. Running them inside the continuation would route a
 * policy 403 through createAuthMiddleware's try/catch, which rewrites every
 * error thrown downstream of it into a 401.
 *
 * Fails closed: if authentication returns without populating `userId` and
 * `credentialType`, the request is rejected with 401.
 *
 * @throws {HTTPException} 401 when authentication fails; 403 SESSION_REQUIRED
 *   when an API token meets a session-only policy; 403 STEP_UP_REQUIRED when an
 *   enrolled user presents a plain session to a step-up route.
 */
export function requireCredential(
  authService: AuthService,
  policy: CredentialPolicy,
) {
  const authenticate = createAuthMiddleware(authService, {
    allowStepUp: policy.stepUp === "if-enrolled",
  });

  return createMiddleware<AuthEnv>(async (c, next) => {
    await authenticate(c, async () => {});

    const userId = c.get("userId");
    const credentialType = c.get("credentialType");

    if (!userId || !credentialType) {
      throw new HTTPException(401, {
        message: "MISSING_COORDINATES: Authentication required",
      });
    }

    if (policy.credential === "session" && credentialType !== "session") {
      throw new HTTPException(403, {
        message:
          "SESSION_REQUIRED: This action requires a user session; API tokens may read data but cannot create or change credentials",
      });
    }

    if (
      policy.stepUp === "if-enrolled" &&
      c.get("tokenPurpose") !== "step_up" &&
      (await authService.hasTotpEnrolled(userId))
    ) {
      throw new HTTPException(403, {
        message:
          "STEP_UP_REQUIRED: This account has TOTP enabled. Call POST /auth/step-up with your authenticator code, then retry with that token in the Authorization header.",
      });
    }

    await next();
  });
}
