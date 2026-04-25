import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { SteamSyncSchema } from "@repo/shared";
import { SteamService } from "./steam.services";
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

  app.post("/sync-achievements", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    try {
      const result = await steamService.syncAllGameAchievements(userId);
      return c.json(
        {
          status: "SUCCESS",
          message: `Synced ${result.synced} games, skipped ${result.skipped} (no achievements)`,
          data: result,
        },
        200,
      );
    } catch (error) {
      console.error(`[SteamController] Full achievement sync failed:`, error);
      throw error;
    }
  });

  app.post("/games/:gameId/sync-achievements", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462"; // swap with authMiddleware later
    const gameId = c.req.param("gameId");

    try {
      const result = await steamService.syncGameAchievements(userId, gameId);
      return c.json({ status: "SUCCESS", data: result }, 200);
    } catch (error) {
      console.error(
        `[SteamController] Achievement sync failed for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  return app;
};
