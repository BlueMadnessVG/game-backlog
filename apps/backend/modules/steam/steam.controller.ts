import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  AchievementFilterSchema,
  AchievementSortSchema,
  SteamSyncSchema,
} from "@repo/shared";
import { SteamService } from "./steam.services";
import * as v from "valibot";

import { authMiddleware } from "../../middleware/auth.middleware";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export const createSteamController = (steamService: SteamService) => {
  const app = new Hono<Bindings>();

  app.get("/games", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    try {
      const library = await steamService.getUserGames(userId);
      const paginatedLibrary = library.slice(offset, offset + limit);

      return c.json(
        {
          status: "SUCCESS",
          meta: {
            total: library.length,
            limit,
            offset,
          },
          data: paginatedLibrary,
        },
        200,
      );
    } catch (error) {
      console.error(`[SteamController] Failed to fetch library:`, error);
      throw error;
    }
  });

  app.get("/games/:id", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
    const gameId = c.req.param("id");

    try {
      const game = await steamService.getUserGame(userId, gameId);

      if (!game) {
        return c.json(
          { status: "NOT_FOUND", message: `Game ${gameId} not found` },
          404,
        );
      }

      return c.json({ status: "SUCCESS", data: game }, 200);
    } catch (error) {
      console.error(`[SteamController] Failed to fetch game ${gameId}:`, error);
      throw error;
    }
  });

  app.post(
    "/sync",
    /* authMiddleware, */
    vValidator("json", SteamSyncSchema),
    async (c) => {
      const { steamId } = c.req.valid("json");

      /* const userId = c.get("userId"); */
      const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
      console.log("DEBUG: Current User ID is:", userId);

      try {
        const [profile, games] = await Promise.all([
          steamService.syncUserProfile(userId, steamId),
          steamService.syncUserGames(userId, steamId),
        ]);

        return c.json(
          {
            status: "SUCCESS",
            message: "Tactical data synchronized",
            data: {
              profile,
              gamesCount: games.length,
            },
          },
          200,
        );
      } catch (error) {
        console.error(
          `[SteamController] Sync failed for user ${userId}:`,
          error,
        );
        throw error;
      }
    },
  );

  app.post("/games/:gameId/sync-achievements", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
    const gameId = c.req.param("gameId");

    try {
      await steamService.syncGameAchievements(userId, gameId);
      return c.json({ status: "SUCCESS", message: "Achievements synced" }, 200);
    } catch (error) {
      console.error(
        `[SteamController] Achievement sync failed for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  app.post("/games/:gameId/achievements", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
    const gameId = c.req.param("gameId");

    const filterResult = v.safeParse(
      AchievementFilterSchema,
      c.req.query("filter") ?? "all",
    );
    const sortResult = v.safeParse(
      AchievementSortSchema,
      c.req.query("sort") ?? "rarity",
    );
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    const offset = Number(c.req.query("offset")) || 0;

    if (!filterResult.success || !sortResult.success) {
      return c.json(
        {
          status: "ERROR",
          message: "Invalid filter or sort value",
        },
        400,
      );
    }

    try {
      const { data, total, unlocked } = await steamService.getGameAchievements(
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
          meta: {
            total,
            unlocked,
            limit,
            offset,
          },
          data,
        },
        200,
      );
    } catch (error) {
      console.error(
        `[SteamController] Failed to fetch achievements for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  return app;
};
