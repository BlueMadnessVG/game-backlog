import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  LoginSchema,
  OAuthCallbackQuerySchema,
  OAuthProviderSchema,
  RegisterSchema,
  CreateApiTokenSchema,
} from "@repo/shared";
import * as v from "valibot";

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  OAuthCallbackError,
} from "./auth.services";
import {
  createAuthMiddleware,
  type CredentialType,
} from "../../middleware/auth.middleware";
import { createRequireSessionCredentialMiddleware } from "../../middleware/require-session-credential.middleware";
import { setSessionCookie, clearSessionCookie } from "../../lib/session-cookie";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
    credentialType: CredentialType;
  };
};

const FRONTEND_FALLBACK = "http://localhost:5173";

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
   * @body { name: string, scope?: string, expiresInDays?: number }
   * @returns 201 with `{ status, data: { id, token, tokenPrefix } }`. The
   *   plaintext `token` is returned in THIS response only — it is never
   *   retrievable again after this.
   */
  app.post(
    "/api-tokens",
    requireAuth,
    requireSessionCredential,
    vValidator("json", CreateApiTokenSchema),
    async (c) => {
      const userId = c.get("userId");
      const { name, scope, expiresInDays } = c.req.valid("json");

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      try {
        const result = await authService.createApiToken(userId, {
          name,
          scope,
          expiresAt,
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
   */
  app.delete("/api-tokens/:id", requireAuth, async (c) => {
    const userId = c.get("userId");
    const tokenId = c.req.param("id");

    try {
      await authService.revokeApiToken(userId, tokenId);
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
