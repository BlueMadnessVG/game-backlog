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

export const createPsnController = (
  psnService: PsnService,
  libraryService: LibraryService,
) => {
  const app = new Hono<Bindings>();

  // GET /psn/games
  app.get("/games", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

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

  // GET /psn/games/:id
  app.get("/games/:id", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
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

  // POST /psn/sync
  app.post("/sync", vValidator("json", PsnSyncSchema), async (c) => {
    const body = c.req.valid("json");
    const { npsso, onlineId } = body as PsnSyncRequest;
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

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
            `[PsnController] Cover enrichment: ${result.enriched} enriched, ${result.skipped} skipped`,
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

  // POST /psn/games/:gameId/sync-trophies
  app.post("/games/:gameId/sync-trophies", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";
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

  // POST /psn/games/:gameId/trophies
  app.post("/games/:gameId/trophies", async (c) => {
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
