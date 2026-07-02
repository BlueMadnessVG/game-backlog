import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { AchievementFilterSchema, AchievementSortSchema } from "@repo/shared";
import { XboxService } from "./xbox.services";
import * as v from "valibot";

import { XboxSyncSchema } from "@repo/shared";
import type { LibraryService } from "../library/library.services";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export const createXboxController = (
  xboxService: XboxService,
  libraryService: LibraryService,
) => {
  const app = new Hono<Bindings>();

  // GET /xbox/games
  app.get("/games", async (c) => {
    const userId = "2533274968382425";

    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    try {
      const library = await xboxService.getUserGames(userId);
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
      console.error(`[XboxController] Failed to fetch library:`, error);
      throw error;
    }
  });

  // GET /xbox/games/:id
  app.get("/games/:id", async (c) => {
    const userId = "2533274968382425";
    const gameId = c.req.param("id");

    try {
      const game = await xboxService.getUserGame(userId, gameId);

      if (!game) {
        return c.json(
          { status: "NOT_FOUND", message: `Game ${gameId} not found` },
          404,
        );
      }

      return c.json({ status: "SUCCESS", data: game }, 200);
    } catch (error) {
      console.error(`[XboxController] Failed to fetch game ${gameId}:`, error);
      throw error;
    }
  });

  // POST /xbox/sync
  app.post("/sync", vValidator("json", XboxSyncSchema), async (c) => {
    const { xuid } = c.req.valid("json");
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    try {
      const [profile, games] = await Promise.all([
        xboxService.syncUserProfile(userId, xuid),
        xboxService.syncUserGames(userId, xuid),
      ]);

      c.status(200);
      const response = c.json({
        status: "SUCCESS",
        message: "Xbox library synced. Achievement data syncing in background.",
        data: { profile, gamesCount: games.length },
      });

      xboxService
        .syncAllGameAchievements(
          userId,
          games.map((g) => g.id),
        )
        .catch((err) => {
          console.error(
            "[XboxController] Background achievement sync failed:",
            err,
          );
        });

      // ✅ new — enrich Xbox covers automatically after every sync
      libraryService
        .enrichGameCovers(userId)
        .then((result) => {
          console.log(
            `[XboxController] Cover enrichment: ${result.enriched} enriched, ${result.skipped} skipped`,
          );
        })
        .catch((err) => {
          console.error("[XboxController] Cover enrichment failed:", err);
        });

      return response;
    } catch (error) {
      console.error(`[XboxController] Sync failed for user ${userId}:`, error);
      throw error;
    }
  });

  // POST /xbox/games/:gameId/sync-achievements
  app.post("/games/:gameId/sync-achievements", async (c) => {
    const userId = "2533274968382425";
    const gameId = c.req.param("gameId");

    try {
      await xboxService.syncGameAchievements(userId, gameId);
      return c.json({ status: "SUCCESS", message: "Achievements synced" }, 200);
    } catch (error) {
      console.error(
        `[XboxController] Achievement sync failed for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  // POST /xbox/games/:gameId/achievements
  app.post("/games/:gameId/achievements", async (c) => {
    const userId = "2533274968382425";
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
        { status: "ERROR", message: "Invalid filter or sort value" },
        400,
      );
    }

    try {
      const { data, total, unlocked } = await xboxService.getGameAchievements(
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
      console.error(
        `[XboxController] Failed to fetch achievements for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  return app;
};
