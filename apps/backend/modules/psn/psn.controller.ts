import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  AchievementFilterSchema,
  AchievementSortSchema,
  PsnSyncSchema,
} from "@repo/shared";
import { PsnService } from "./psn.services";
import * as v from "valibot";
import type { LibraryService } from "../library/library.services";

import { authMiddleware } from "../../middleware/auth.middleware";

type PsnSyncRequest = {
  npsso: string;
  onlineId: string;
};

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * Creates the Hono router for all PSN-related HTTP endpoints.
 *
 * @remarks
 * This controller is a thin pass-through: it validates inputs, delegates
 * to {@link PsnService} and {@link LibraryService}, and formats the
 * JSON response. No business logic lives here.
 *
 * The user id comes from the authenticated session — authMiddleware
 * resolves the JWT and exposes it as `c.get("userId")`.
 *
 * @param psnService - Service layer for PSN account, game, and trophy
 *   operations.
 * @param libraryService - Service layer for cross-platform cover enrichment.
 * @returns A configured `Hono` app instance with all PSN routes mounted.
 *
 * @example
 * ```ts
 * const psn = createPsnController(psnService, libraryService);
 * app.route("/psn", psn);
 * ```
 */
export const createPsnController = (
  psnService: PsnService,
  libraryService: LibraryService,
) => {
  const app = new Hono<Bindings>();

  app.use("*", authMiddleware);

  /**
   * GET /psn/games
   *
   * Returns the authenticated user's PSN game library with pagination.
   *
   * @query limit - Maximum games to return (default `50`).
   * @query offset - Row offset for pagination (default `0`).
   * @returns 200 with `{ status, meta: { total, limit, offset }, data }`.
   */
  app.get("/games", async (c) => {
    const userId = c.get("userId");

    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    try {
      const library = await psnService.getUserGames(userId);
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
      console.error(`[PsnController] Failed to fetch library:`, error);
      throw error;
    }
  });

  /**
   * GET /psn/games/:id
   *
   * Returns a single PSN game from the user's library by UUID.
   *
   * @param id - The game UUID.
   * @returns 200 with `{ status, data }`, or 404 when the game is not found.
   */
  app.get("/games/:id", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("id");

    try {
      const game = await psnService.getUserGame(userId, gameId);

      if (!game) {
        return c.json(
          { status: "NOT_FOUND", message: `Game ${gameId} not found` },
          404,
        );
      }

      return c.json({ status: "SUCCESS", data: game }, 200);
    } catch (error) {
      console.error(`[PsnController] Failed to fetch game ${gameId}:`, error);
      throw error;
    }
  });

  /**
   * POST /psn/sync
   *
   * Exchanges the NPSSO for PSN auth tokens, syncs the user's profile and
   * game library, then fires background jobs for trophy sync and cover
   * enrichment. Returns immediately after the profile+games upsert.
   *
   * @body PsnSyncSchema `{ npsso: string, onlineId: string }`
   * @returns 200 with `{ status, message, data: { profile, gamesCount } }`.
   */
  app.post("/sync", vValidator("json", PsnSyncSchema), async (c) => {
    const body = c.req.valid("json");
    const { npsso, onlineId } = body as PsnSyncRequest;
    const userId = c.get("userId");

    try {
      const profile = await psnService.syncUserProfile(userId, npsso, onlineId);
      const insertedGames = await psnService.syncUserGames(userId);

      c.status(200);
      const response = c.json({
        status: "SUCCESS",
        message: "PSN library synced. Trophy data syncing in background.",
        data: {
          profile: {
            accountId: profile.accountId,
            onlineId: profile.onlineId,
            avatarUrl: profile.avatarUrl,
          },
          gamesCount: insertedGames.length,
        },
      });

      psnService
        .syncAllGameTrophies(
          userId,
          insertedGames.map((g) => g.id),
        )
        .catch((err) => {
          console.error("[PsnController] Background trophy sync failed:", err);
        });

      libraryService
        .enrichGameCovers(userId)
        .then((result) => {
          console.log(
            `[PsnController] Cover enrichment: ${result.enriched} enriched`,
          );
        })
        .catch((err) => {
          console.error("[PsnController] Cover enrichment failed:", err);
        });

      return response;
    } catch (error) {
      console.error(`[PsnController] Sync failed for user ${userId}:`, error);
      throw error;
    }
  });

  /**
   * POST /psn/games/:gameId/sync-trophies
   *
   * Triggers a full trophy sync for a single game, scoped to the
   * requesting user's ownership.
   *
   * @param gameId - The game UUID to sync trophies for.
   * @returns 200 on success, or rethrows service-layer errors (e.g.
   *   `PsnGameNotFoundError`).
   */
  app.post("/games/:gameId/sync-trophies", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    try {
      await psnService.syncGameTrophies(userId, gameId);
      return c.json({ status: "SUCCESS", message: "Trophies synced" }, 200);
    } catch (error) {
      console.error(
        `[PsnController] Trophy sync failed for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  /**
   * POST /psn/games/:gameId/trophies
   *
   * Returns paginated, filterable, sortable trophies for a single game.
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
  app.post("/games/:gameId/trophies", async (c) => {
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
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    const offset = Number(c.req.query("offset")) || 0;

    if (!filterResult.success || !sortResult.success) {
      return c.json(
        { status: "ERROR", message: "Invalid filter or sort value" },
        400,
      );
    }

    try {
      const { data, total, unlocked } = await psnService.getGameTrophies(
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
        `[PsnController] Failed to fetch trophies for game ${gameId}:`,
        error,
      );
      throw error;
    }
  });

  return app;
};
