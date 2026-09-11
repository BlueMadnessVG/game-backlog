import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  LoginSchema,
  OAuthCallbackQuerySchema,
  OAuthProviderSchema,
  RegisterSchema,
} from "@repo/shared";
import * as v from "valibot";

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  OAuthCallbackError,
} from "./auth.services";
import { authMiddleware } from "../../middleware/auth.middleware";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const FRONTEND_FALLBACK = "http://localhost:5173";

/**
 * Creates the Hono router for all auth-related HTTP endpoints.
 *
 * Flow: `GET /auth/:provider` starts the provider dance; the provider
 * redirects back to `GET /auth/:provider/callback`, which exchanges the code,
 * upserts the user, signs a session JWT and bounces the browser to
 * `FRONTEND_URL/auth/callback#token=<jwt>` (fragment so the token never
 * reaches server logs).
 *
 * @param authService - Service layer for the OAuth flow + session issuance.
 * @returns A configured `Hono` app instance with all auth routes mounted.
 */
export const createAuthController = (authService: AuthService) => {
  const app = new Hono<Bindings>();

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
  app.get("/me", authMiddleware, async (c) => {
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
   * Creates an email/password account and returns a session token.
   */
  app.post("/register", vValidator("json", RegisterSchema), async (c) => {
    try {
      const { token, user, created } = await authService.register(
        c.req.valid("json"),
      );

      return c.json(
        {
          status: "SUCCESS",
          data: { token, user, created },
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
   * Validates email/password and returns a session token.
   */
  app.post("/login", vValidator("json", LoginSchema), async (c) => {
    try {
      const { token, user, created } = await authService.login(
        c.req.valid("json"),
      );

      return c.json(
        {
          status: "SUCCESS",
          data: { token, user, created },
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
   * Completes the OAuth flow, then redirects to the frontend with the JWT in
   * the URL fragment (or an error fragment on failure).
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
        const { token } = await authService.handleCallback(provider, code, state);
        return c.redirect(`${frontendUrl()}/auth/callback#token=${token}`, 302);
      } catch (error) {
        console.error("[AuthController] OAuth callback failed:", error);
        const reason =
          error instanceof OAuthCallbackError
            ? "invalid_state"
            : "authentication_failed";
        return c.redirect(`${frontendUrl()}/auth/callback#error=${reason}`, 302);
      }
    },
  );

  return app;
};
