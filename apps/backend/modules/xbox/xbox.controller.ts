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

/**
 * Creates the Hono router for all Xbox-related HTTP endpoints.
 *
 * @remarks
 * This controller is a thin pass-through: it validates inputs, delegates
 * to {@link XboxService} and {@link LibraryService}, and formats the
 * JSON response. No business logic lives here.
 *
 * Hardcoded user IDs are placeholders replaced by auth middleware before
 * this controller is reached.
 *
 * @param xboxService - Service layer for Xbox account, game, and
 *   achievement operations.
 * @param libraryService - Service layer for cross-platform cover enrichment.
 * @returns A configured `Hono` app instance with all Xbox routes mounted.
 *
 * @example
 * ```ts
 * const xbox = createXboxController(xboxService, libraryService);
 * app.route("/xbox", xbox);
 * ```
 */
export const createXboxController = (
  xboxService: XboxService,
  libraryService: LibraryService,
) => {
  const app = new Hono<Bindings>();

  /**
   * GET /xbox/games
   *
   * Returns the authenticated user's Xbox game library with pagination.
   *
   * @query limit - Maximum games to return (default `50`).
   * @query offset - Row offset for pagination (default `0`).
   * @returns 200 with `{ status, meta: { total, limit, offset }, data }`.
   */
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

  /**
   * GET /xbox/games/:id
   *
   * Returns a single Xbox game from the user's library by UUID.
   *
   * @param id - The game UUID.
   * @returns 200 with `{ status, data }`, or 404 when the game is not found.
   */
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

  /**
   * POST /xbox/sync
   *
   * Syncs the user's Xbox profile and game library, then fires background
   * jobs for achievement sync and cover enrichment. Returns immediately
   * after the profile+games upsert completes.
   *
   * @body XboxSyncSchema `{ xuid: string }`
   * @returns 200 with `{ status, message, data: { profile, gamesCount } }`.
   */
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

      libraryService
        .enrichGameCovers(userId)
        .then((result) => {
          console.log(
            `[XboxController] Cover enrichment: ${result.enriched} enriched`,
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

  /**
   * POST /xbox/games/:gameId/sync-achievements
   *
   * Triggers a full achievement sync for a single game, scoped to the
   * requesting user's ownership.
   *
   * @param gameId - The game UUID to sync achievements for.
   * @returns 200 on success, or rethrows service-layer errors (e.g.
   *   `XboxGameNotFoundError`).
   */
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

  /**
   * POST /xbox/games/:gameId/achievements
   *
   * Returns paginated, filterable, sortable achievements for a single game.
   * Triggers a lazy sync when no cached data exists.
   *
   * @param gameId - The game UUID.
   * @query filter - `'all'` | `'unlocked'` | `'locked'` (default `'all'`).
   * @query sort - `'rarity'` | `'unlock-date'` | `'name'` (default `'rarity'`).
   * @query limit - Maximum rows (default `50`, max `100`).
   * @query offset - Row offset for pagination (default `0`).
   * @returns 200 with `{ status, meta: { total, unlocked, limit, offset }, data }`,
   *   or 400 when filter/sort values are invalid.
   */
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
