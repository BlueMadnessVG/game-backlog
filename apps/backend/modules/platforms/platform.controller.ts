import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import { AchievementFilterSchema, AchievementSortSchema } from "@repo/shared";

import { createAuthMiddleware } from "../../middleware/auth.middleware";
import type { AuthService } from "../auth/auth.services";
import type { LibraryService } from "../library/library.services";
import { GameNotFoundError } from "./errors";
import type { PlatformLibrary } from "./platform-library";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const MAX_PAGE_SIZE = 100;

/**
 * Builds the router for one platform (`/steam`, `/xbox`, `/psn`). The routes,
 * paths and response shapes are identical for every platform; the only part
 * that differs is the body of `POST /sync`, which is whatever that platform
 * needs to link an account (`adapter.linkSchema`).
 *
 * @remarks
 * Pure pass-through: it validates input, calls {@link PlatformLibrary} (and
 * {@link LibraryService} for reads of the library itself), and shapes the
 * JSON. The user id comes from the authenticated credential.
 *
 *  - `GET  /games`                           the user's games on this platform, paged
 *  - `GET  /games/:id`                       one game
 *  - `POST /sync`                            link the account and sync the library
 *  - `POST /games/:gameId/sync-achievements` re-sync one game's achievements
 *  - `POST /games/:gameId/achievements`      one page of a game's achievements
 */
export const createPlatformController = ({
  library,
  libraryService,
  authService,
}: {
  library: PlatformLibrary<any, any>;
  libraryService: LibraryService;
  authService: AuthService;
}) => {
  const app = new Hono<Bindings>();
  const platform = library.platform;

  app.use("*", createAuthMiddleware(authService));

  const gameNotFound = (message: string) => ({
    status: "ERROR" as const,
    message,
  });

  app.get("/games", async (c) => {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit")) || 50, MAX_PAGE_SIZE);
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    const { games, total } = await libraryService.getUserGames(
      userId,
      { platform },
      { limit, offset },
    );

    return c.json(
      { status: "SUCCESS", meta: { total, limit, offset }, data: games },
      200,
    );
  });

  app.get("/games/:id", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("id");

    const { games } = await libraryService.getUserGames(
      userId,
      { id: gameId, platform },
      { limit: 1, offset: 0 },
    );
    const game = games[0];

    if (!game) {
      return c.json(
        { status: "NOT_FOUND", message: `Game ${gameId} not found` },
        404,
      );
    }

    return c.json({ status: "SUCCESS", data: game }, 200);
  });

  app.post(
    "/sync",
    vValidator("json", library.adapter.linkSchema as never),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json" as never);

      const { profile, gameIds } = await library.link(userId, body);

      const response = c.json({
        status: "SUCCESS",
        message: "Library synced. Achievement data syncing in background.",
        data: { profile, gamesCount: gameIds.length },
      });

      // Background work: the response doesn't wait for it.
      library.syncAllAchievements(userId, gameIds).catch((err) => {
        console.error(
          `[PlatformController:${platform}] Background achievement sync failed:`,
          err,
        );
      });

      if (library.adapter.enrichCovers) {
        libraryService
          .enrichGameCovers(userId)
          .then((result) => {
            console.log(
              `[PlatformController:${platform}] Cover enrichment: ${result.enriched} enriched`,
            );
          })
          .catch((err) => {
            console.error(
              `[PlatformController:${platform}] Cover enrichment failed:`,
              err,
            );
          });
      }

      return response;
    },
  );

  app.post("/games/:gameId/sync-achievements", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    try {
      await library.syncAchievements(userId, gameId);
      return c.json({ status: "SUCCESS", message: "Achievements synced" }, 200);
    } catch (error) {
      if (error instanceof GameNotFoundError) {
        return c.json(gameNotFound(error.message), 404);
      }
      throw error;
    }
  });

  app.post("/games/:gameId/achievements", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    const filterResult = v.safeParse(
      AchievementFilterSchema,
      c.req.query("filter") ?? "all",
    );
    const sortResult = v.safeParse(
      AchievementSortSchema,
      c.req.query("sort") ?? "rarity",
    );
    const limit = Math.min(Number(c.req.query("limit")) || 50, MAX_PAGE_SIZE);
    const offset = Number(c.req.query("offset")) || 0;

    if (!filterResult.success || !sortResult.success) {
      return c.json(
        { status: "ERROR", message: "Invalid filter or sort value" },
        400,
      );
    }

    try {
      const { data, total, unlocked } = await library.getAchievements(
        userId,
        gameId,
        {
          filter: filterResult.output,
          sort: sortResult.output,
          limit,
          offset,
        },
      );

      return c.json(
        {
          status: "SUCCESS",
          meta: { total, unlocked, limit, offset },
          data,
        },
        200,
      );
    } catch (error) {
      if (error instanceof GameNotFoundError) {
        return c.json(gameNotFound(error.message), 404);
      }
      throw error;
    }
  });

  return app;
};
