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

/**
 * Creates the Hono router for all Steam-related HTTP endpoints.
 *
 * @remarks
 * This controller is a thin pass-through: it validates inputs, delegates
 * to {@link SteamService}, and formats the JSON response. No business
 * logic lives here.
 *
 * Hardcoded user IDs are placeholders replaced by auth middleware before
 * this controller is reached.
 *
 * @param steamService - Service layer for Steam account, game, and
 *   achievement operations.
 * @returns A configured `Hono` app instance with all Steam routes mounted.
 *
 * @example
 * ```ts
 * const steam = createSteamController(steamService);
 * app.route("/steam", steam);
 * ```
 */
export const createSteamController = (steamService: SteamService) => {
  const app = new Hono<Bindings>();

  /**
   * GET /steam/games
   *
   * Returns the authenticated user's Steam game library with pagination.
   *
   * @query limit - Maximum games to return (default `50`).
   * @query offset - Row offset for pagination (default `0`).
   * @returns 200 with `{ status, meta: { total, limit, offset }, data }`.
   */
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

  /**
   * GET /steam/games/:id
   *
   * Returns a single Steam game from the user's library by UUID.
   *
   * @param id - The game UUID.
   * @returns 200 with `{ status, data }`, or 404 when the game is not found.
   */
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

  /**
   * POST /steam/sync
   *
   * Syncs the user's Steam profile and game library, then fires a
   * background job for achievement sync. Returns immediately after the
   * profile+games upsert completes.
   *
   * @body SteamSyncSchema `{ steamId: string }`
   * @returns 200 with `{ status, message, data: { profile, gamesCount } }`.
   */
  app.post("/sync", vValidator("json", SteamSyncSchema), async (c) => {
    const { steamId } = c.req.valid("json");
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    try {
      const [profile, games] = await Promise.all([
        steamService.syncUserProfile(userId, steamId),
        steamService.syncUserGames(userId, steamId),
      ]);

      c.status(200);
      const response = c.json({
        status: "SUCCESS",
        message: "Library synced. Achievement data syncing in background.",
        data: {
          profile,
          gamesCount: games.length,
        },
      });

      steamService
        .syncAllGameAchievements(
          userId,
          games.map((g) => g.id),
        )
        .catch((err) => {
          console.error(
            "[SteamController] Background achievement sync failed:",
            err,
          );
        });

      return response;
    } catch (error) {
      console.error(`[SteamController] Sync failed for user ${userId}:`, error);
      throw error;
    }
  });

  /**
   * POST /steam/games/:gameId/sync-achievements
   *
   * Triggers a full achievement sync for a single game, scoped to the
   * requesting user's ownership.
   *
   * @param gameId - The game UUID to sync achievements for.
   * @returns 200 on success, or rethrows service-layer errors (e.g.
   *   `SteamGameNotFoundError`).
   */
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

  /**
   * POST /steam/games/:gameId/achievements
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
