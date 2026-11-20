import { Hono } from "hono";
import * as v from "valibot";
import { PlatformRouteSchema } from "@repo/shared";

import { NotFoundError, ValidationError } from "../../lib/errors";
import { createAuthMiddleware } from "../../middleware/auth.middleware";
import type { AuthService } from "../auth/auth.services";
import type { AccountsService } from "./accounts.services";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * `/api/v1/accounts` — the user's linked platform accounts.
 *
 *  - `GET    /`          which of Steam / Xbox / PSN are linked, and as whom
 *  - `DELETE /:platform` unlink one (`steam`, `xbox` or `psn`); imported games stay
 *
 * Linking is `POST /{platform}/sync`, which also imports the library.
 */
export const createAccountsController = (
  accountsService: AccountsService,
  authService: AuthService,
) => {
  const app = new Hono<Bindings>();

  app.use("*", createAuthMiddleware(authService));

  app.get("/", async (c) => {
    const data = await accountsService.getLinked(c.get("userId"));
    return c.json({ status: "SUCCESS", data }, 200);
  });

  app.delete("/:platform", async (c) => {
    const parsed = v.safeParse(PlatformRouteSchema, c.req.param("platform"));
    if (!parsed.success) {
      throw new ValidationError("Unsupported platform", [
        { path: "platform", message: "Expected steam, xbox or psn" },
      ]);
    }

    const removed = await accountsService.unlink(c.get("userId"), parsed.output);
    if (!removed) {
      throw new NotFoundError(
        "ACCOUNT_NOT_LINKED",
        `No ${parsed.output} account linked`,
      );
    }

    return c.json({ status: "SUCCESS", message: "Account unlinked" }, 200);
  });

  return app;
};
