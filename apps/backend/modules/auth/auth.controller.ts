import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  LoginSchema,
  OAuthCallbackQuerySchema,
  OAuthProviderSchema,
  RegisterSchema,
  CreateApiTokenSchema,
  TotpEnrollSchema,
  TotpStepUpSchema,
} from "@repo/shared";
import * as v from "valibot";

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTotpCodeError,
  OAuthCallbackError,
  TotpNotEnrolledError,
  type ApiTokenAuditContext,
} from "./auth.services";
import {
  createAuthMiddleware,
  type CredentialType,
} from "../../middleware/auth.middleware";
import { createRequireSessionCredentialMiddleware } from "../../middleware/require-session-credential.middleware";
import { setSessionCookie, clearSessionCookie } from "../../lib/session-cookie";
import type { TokenPurpose } from "../../lib/jwt.utils";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
    credentialType: CredentialType;
    tokenPurpose: TokenPurpose;
  };
};

const FRONTEND_FALLBACK = "http://localhost:5173";

/**
 * Captures request context for the API-token audit trail (stored in
 * api_token_events). Written in the request handler rather than the
 * service because only the middleware/controller can see headers — the
 * service layer receives the already-captured context.
 *
 * Deliberately a minimal structural type rather than Hono's `Context`:
 * Hono's `Context` is invariant in its variable bindings, so a real
 * handler's `Context<Bindings & Env, "/path">` would not be assignable to
 * a `Context<Bindings>` parameter. Structurally, all we need is `get`
 * and `req.header`.
 *
 * IP via x-forwarded-for (split, first hop = the original client) with
 * x-real-ip/precedence fallback; "unknown" stays a literal value rather
 * than null so audit rows are always comparable.
 */
type AuditRequestSource = {
  get: <K extends keyof Bindings["Variables"]>(
    key: K,
  ) => Bindings["Variables"][K];
  req: { header: (name: string) => string | undefined };
};

const clientAuditContext = (c: AuditRequestSource): ApiTokenAuditContext => ({
  triggeredBy: c.get("credentialType") ?? "session",
  ip:
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown",
  userAgent: c.req.header("user-agent") ?? null,
});

/**
 * Creates the Hono router for all auth-related HTTP endpoints.
 *
 * Flow: `GET /auth/:provider` starts the provider dance; the provider
 * redirects back to `GET /auth/:provider/callback`, which exchanges the
 * code, upserts the user, signs a session JWT, sets it as an HttpOnly
 * cookie, and bounces the browser to `FRONTEND_URL/auth/callback` — no
 * token in the URL fragment anymore (see setSessionCookie's doc comment
 * for why a cookie instead of a response-body token is the fix here).
 *
 * `/login` and `/register` follow the same cookie-setting pattern. The
 * JSON response body for all three no longer includes the raw token —
 * only `user`/`created`. Call `/auth/me` to confirm an active session
 * instead of inspecting a token the frontend never sees.
 *
 * `/api-tokens` (create/list/revoke) is UNCHANGED by this — those are
 * opaque, long-lived credentials for machine clients (e.g. the
 * achievement-ai assistant), issued over Bearer auth, and deliberately
 * still returned in the response body exactly once. That's a different
 * credential for a different kind of client; this change is specifically
 * about the browser session.
 *
 * @param authService - Service layer for the OAuth flow, session
 *   issuance, and API token issuance.
 * @returns A configured `Hono` app instance with all auth routes mounted.
 */
export const createAuthController = (authService: AuthService) => {
  const app = new Hono<Bindings>();

  const requireAuth = createAuthMiddleware(authService);
  // Used ONLY on POST /api-tokens. Accepts a normal session OR a
  // TOTP step-up (`purpose: "step_up"`) JWT; both are sessions, and the
  // step-up proof is what unlocks minting for an enrolled user (see the
  // enrollment check in that handler).
  const requireAuthForMint = createAuthMiddleware(authService, {
    allowStepUp: true,
  });
  // Mounted only on POST /api-tokens: minting a long-lived credential is a
  // human-only action. See require-session-credential.middleware.ts for why.
  const requireSessionCredential = createRequireSessionCredentialMiddleware();
  const frontendUrl = () => process.env.FRONTEND_URL ?? FRONTEND_FALLBACK;

  const providerParam = (raw: string | undefined) => {
    const result = v.safeParse(OAuthProviderSchema, raw);
    return result.success ? result.output : null;
  };

  /**
   * GET /auth/me
   *
   * Returns the currently authenticated user.
   */
  app.get("/me", requireAuth, async (c) => {
    const user = await authService.getUserById(c.get("userId"));

    if (!user) {
      return c.json({ status: "ERROR", message: "User not found" }, 404);
    }

    return c.json(
      {
        status: "SUCCESS",
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      200,
    );
  });

  /**
   * GET /auth/providers
   *
   * Returns the configured social sign-in providers so the frontend can render
   * its buttons from a single source of truth instead of hardcoding them.
   * The UI decides which of these to surface.
   */
  app.get("/providers", async (c) => {
    return c.json(
      {
        status: "SUCCESS",
        data: {
          providers: authService.getAvailableProviders(),
        },
      },
      200,
    );
  });

  /**
   * POST /auth/register
   *
   * Creates an email/password account, sets the session cookie, and
   * returns the user (no token in the body — see setSessionCookie).
   */
  app.post("/register", vValidator("json", RegisterSchema), async (c) => {
    try {
      const { token, user, created } = await authService.register(
        c.req.valid("json"),
      );

      setSessionCookie(c, token);

      return c.json(
        {
          status: "SUCCESS",
          data: { user, created },
        },
        201,
      );
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return c.json(
          {
            status: "ERROR",
            message:
              "This email is already registered. Sign in or use a different account.",
          },
          409,
        );
      }
      throw error;
    }
  });

  /**
   * POST /auth/login
   *
   * Validates email/password, sets the session cookie, and returns the
   * user (no token in the body — see setSessionCookie).
   */
  app.post("/login", vValidator("json", LoginSchema), async (c) => {
    try {
      const { token, user, created } = await authService.login(
        c.req.valid("json"),
      );

      setSessionCookie(c, token);

      return c.json(
        {
          status: "SUCCESS",
          data: { user, created },
        },
        200,
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return c.json(
          {
            status: "ERROR",
            message: "Invalid email or password",
          },
          401,
        );
      }
      throw error;
    }
  });

  /**
   * POST /auth/logout
   *
   * Clears the session cookie. Doesn't invalidate the underlying JWT
   * itself (it's stateless, same as before this change) — it just stops
   * the browser from presenting it. A stolen cookie's JWT remains valid
   * until its own expiry regardless; that was already true before this
   * change too, and is a separate concern from what this step addresses.
   */
  app.post("/logout", async (c) => {
    clearSessionCookie(c);
    return c.json({ status: "SUCCESS", message: "Logged out" }, 200);
  });

/**
    * POST /auth/api-tokens
    *
    * Creates a new opaque API token for the authenticated user (e.g. for
    * the achievement-ai assistant, or any other machine client).
    *
    * Session-only by design: `requireSessionCredential` rejects `bkl_...`
    * callers with 403, so an API token can never mint another one. Without
    * that gate a single leaked token could keep re-issuing itself forever,
    * and revoking it would not evict the children it created.
    *
    * TOTP step-up (only-if-enrolled): a user WITH an enrolled TOTP secret
    * must present a `purpose: "step_up"` JWT — obtained from
    * POST /auth/step-up — to reach this handler; a plain session is
    * rejected with 403 STEP_UP_REQUIRED. A user WITHOUT a secret skips
    * step-up entirely (nothing to prove). The step-up token is a 5-minute
    * credential accepted by `requireAuthForMint` only, so a regular
    * session can never be minting-authority without the second factor.
    *
    * @body { name: string, scope?: string, expiresInDays?: number }
    * @returns 201 with `{ status, data: { id, token, tokenPrefix } }`. The
    *   plaintext `token` is returned in THIS response only — it is never
    *   retrievable again after this.
    */
   app.post(
     "/api-tokens",
     requireAuthForMint,
     requireSessionCredential,
     vValidator("json", CreateApiTokenSchema),
     async (c) => {
       const userId = c.get("userId");
       const { name, scope, expiresInDays } = c.req.valid("json");

       if (
         (await authService.hasTotpEnrolled(userId)) &&
         c.get("tokenPurpose") !== "step_up"
       ) {
         return c.json(
           {
             status: "ERROR",
             message:
               "STEP_UP_REQUIRED: This account has TOTP enabled. Call POST /auth/step-up with your authenticator code, then retry with that token in the Authorization header.",
           },
           403,
         );
       }

       const expiresAt = expiresInDays
         ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
         : undefined;

       try {
         const result = await authService.createApiToken(userId, {
           name,
           scope,
           expiresAt,
           audit: clientAuditContext(c),
         });

         return c.json({ status: "SUCCESS", data: result }, 201);
       } catch (error) {
         console.error(
           `[AuthController] Failed to create API token for user ${userId}:`,
           error,
         );
         throw error;
       }
     },
   );

  /**
   * GET /auth/api-tokens
   *
   * Lists the authenticated user's API tokens. Never includes the secret
   * itself — only the stored prefix, so the user can tell tokens apart.
   */
  app.get("/api-tokens", requireAuth, async (c) => {
    const userId = c.get("userId");

    try {
      const tokens = await authService.listApiTokens(userId);
      return c.json({ status: "SUCCESS", data: tokens }, 200);
    } catch (error) {
      console.error(
        `[AuthController] Failed to list API tokens for user ${userId}:`,
        error,
      );
      throw error;
    }
  });

  /**
   * DELETE /auth/api-tokens/:id
   *
   * Revokes one of the authenticated user's API tokens (soft delete —
   * scoped to the authenticated user, so one user can never revoke
   * another user's token by guessing an id).
   *
   * 404 when no token of theirs matched the id (either it doesn't exist,
   * or it belongs to a different user — both look identical to the
   * caller so they can't enumerate other users' token ids).
   */
  app.delete("/api-tokens/:id", requireAuth, async (c) => {
    const userId = c.get("userId");
    const tokenId = c.req.param("id");

    try {
      const revoked = await authService.revokeApiToken(
        userId,
        tokenId,
        clientAuditContext(c),
      );
      if (!revoked) {
        return c.json({ status: "ERROR", message: "Token not found" }, 404);
      }
      return c.json({ status: "SUCCESS", message: "Token revoked" }, 200);
    } catch (error) {
      console.error(
        `[AuthController] Failed to revoke API token ${tokenId}:`,
        error,
      );
      throw error;
    }
  });

/**
    * POST /auth/totp/enroll
    *
    * Opts the authenticated (session) user into TOTP MFA. Generates a fresh
    * secret, verifies the presented authenticator code against it BEFORE
    * persisting, then stores the secret. Must wrap the generated secret in
    * an authenticator app within the code's 30-second window — that's
    * exactly the proof enrollment exists to demand (a secret nobody saved
    * would lock token minting behind an unwinnable step-up).
    *
    * Re-enrolling rotates the secret; the returned otpauth URL must be
    * scanned again. The base32 `secret` is shown once, in this response
    * — it is never retrievable again, matching how API-token plaintext is
    * handled.
    *
    * @body { code: "012345" }
    * @returns 201 with `{ status, data: { secret, otpauthUrl } }`.
    */
   app.post(
     "/totp/enroll",
     requireAuth,
     vValidator("json", TotpEnrollSchema),
     async (c) => {
       const userId = c.get("userId");
       const { code } = c.req.valid("json");

       try {
         const data = await authService.enrollTotp(userId, code);
         return c.json({ status: "SUCCESS", data }, 201);
       } catch (error) {
         if (error instanceof InvalidTotpCodeError) {
           return c.json({ status: "ERROR", message: error.message }, 400);
         }
         throw error;
       }
     },
   );

   /**
    * POST /auth/step-up
    *
    * Returns a SHORT-LIVED (5-minute) `purpose: "step_up"` session token
    * in exchange for a valid TOTP code. This token is the second factor
    * that unlocks POST /auth/api-tokens for a TOTP-enrolled account (the
    * mint route's middleware only accepts step-up JWTs for that one path).
    *
    * The token comes back in the RESPONSE BODY, not a cookie: minting is a
    * JSON-body client flow, and a step-up Set-Cookie would overwrite the
    * normal session cookie. The frontend sends it as
    * `Authorization: Bearer <token>` on the mint call. It expires in 5
    * minutes and is useless as a general session — verifyAuthToken rejects
    * non-"session" purposes everywhere else.
    *
    * Only-if-enrolled: a user without a TOTP secret gets 400 — there's
    * nothing to verify, and they don't need step-up (they mint on a plain
    * session).
    *
    * @body { code: "012345" }
    * @returns 200 with `{ status, data: { token, expiresAt } }`.
    */
   app.post(
     "/step-up",
     requireAuth,
     vValidator("json", TotpStepUpSchema),
     async (c) => {
       const userId = c.get("userId");
       const { code } = c.req.valid("json");

       try {
         const data = await authService.stepUpTotp(userId, code);
         return c.json({ status: "SUCCESS", data }, 200);
       } catch (error) {
         if (error instanceof InvalidTotpCodeError) {
           return c.json({ status: "ERROR", message: error.message }, 400);
         }
         if (error instanceof TotpNotEnrolledError) {
           return c.json({ status: "ERROR", message: error.message }, 400);
         }
         throw error;
       }
     },
   );

   /**
    * GET /auth/:provider
    *
    * Starts the OAuth flow by redirecting to the provider's authorize page.
    */
   app.get("/:provider", async (c) => {
    const provider = providerParam(c.req.param("provider"));
    if (!provider) {
      return c.json({ status: "ERROR", message: "Unsupported provider" }, 400);
    }

    const url = await authService.createAuthorizationUrl(provider);
    return c.redirect(url.toString(), 302);
  });

  /**
   * GET /auth/:provider/callback
   *
   * Completes the OAuth flow, sets the session cookie, and redirects to
   * the frontend with NO token in the URL anymore (the old `#token=`
   * fragment approach existed specifically to keep the token out of
   * server logs — a cookie set via a Set-Cookie header on this same
   * response achieves that more directly, with nothing sensitive in the
   * redirect URL at all). On failure, still redirects with an error
   * fragment so the frontend can show why.
   */
  app.get(
    "/:provider/callback",
    vValidator("query", OAuthCallbackQuerySchema),
    async (c) => {
      const provider = providerParam(c.req.param("provider"));
      if (!provider) {
        return c.redirect(
          `${frontendUrl()}/auth/callback#error=unsupported_provider`,
          302,
        );
      }

      const { code, state } = c.req.valid("query");

      try {
        const { token } = await authService.handleCallback(
          provider,
          code,
          state,
        );
        setSessionCookie(c, token);
        return c.redirect(`${frontendUrl()}/auth/callback`, 302);
      } catch (error) {
        console.error("[AuthController] OAuth callback failed:", error);
        const reason =
          error instanceof OAuthCallbackError
            ? "invalid_state"
            : "authentication_failed";
        return c.redirect(
          `${frontendUrl()}/auth/callback#error=${reason}`,
          302,
        );
      }
    },
  );

  return app;
};
