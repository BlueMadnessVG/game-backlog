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

  app.post(
    "/sync",
    /* authMiddleware, */
    vValidator("json", SteamSyncSchema),
    async (c) => {
      const { steamId } = c.req.valid("json");

      const userId = c.get("userId");

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

  return app;
};
