import { Hono } from "hono";
import {
  GameNotFoundError,
  LibraryService,
  type GameLibraryFilter,
} from "./library.services";

import { authMiddleware } from "../../middleware/auth.middleware";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const VALID_PLATFORMS = ["steam", "xbox", "playstation"] as const;
const VALID_STATUSES = [
  "backlog",
  "in-progress",
  "completed",
  "retired",
] as const;

const VALID_ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const VALID_ACHIEVEMENT_SORTS = ["unlock-date", "name", "rarity"] as const;

function parseGameFilter(query: Record<string, string | undefined>): {
  filter: GameLibraryFilter;
  error?: string;
} {
  const filter: GameLibraryFilter = {};

  if (query.id) filter.id = query.id;
  if (query.title) filter.title = query.title;

  if (query.platform) {
    if (!VALID_PLATFORMS.includes(query.platform as any)) {
      return {
        filter,
        error: `Invalid platform "${query.platform}". Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      };
    }
    filter.platform = query.platform as GameLibraryFilter["platform"];
  }

  if (query.status) {
    if (!VALID_STATUSES.includes(query.status as any)) {
      return {
        filter,
        error: `Invalid status "${query.status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
      };
    }
    filter.status = query.status as GameLibraryFilter["status"];
  }

  return { filter };
}

function parseAchievementOptions(query: Record<string, string | undefined>): {
  options: {
    filter?: (typeof VALID_ACHIEVEMENT_FILTERS)[number];
    sort?: (typeof VALID_ACHIEVEMENT_SORTS)[number];
    limit: number;
    offset: number;
  };
  error?: string;
} {
  const options: {
    filter?: (typeof VALID_ACHIEVEMENT_FILTERS)[number];
    sort?: (typeof VALID_ACHIEVEMENT_SORTS)[number];
    limit: number;
    offset: number;
  } = {
    limit: Number(query.limit) || 50,
    offset: Number(query.offset) || 0,
  };

  if (query.filter) {
    if (!VALID_ACHIEVEMENT_FILTERS.includes(query.filter as any)) {
      return {
        options,
        error: `Invalid filter "${query.filter}". Must be one of: ${VALID_ACHIEVEMENT_FILTERS.join(", ")}`,
      };
    }
    options.filter = query.filter as (typeof VALID_ACHIEVEMENT_FILTERS)[number];
  }

  if (query.sort) {
    if (!VALID_ACHIEVEMENT_SORTS.includes(query.sort as any)) {
      return {
        options,
        error: `Invalid sort "${query.sort}". Must be one of: ${VALID_ACHIEVEMENT_SORTS.join(", ")}`,
      };
    }
    options.sort = query.sort as (typeof VALID_ACHIEVEMENT_SORTS)[number];
  }

  return { options };
}

export const createLibraryController = (libraryService: LibraryService) => {
  const app = new Hono<Bindings>();

  app.use("*", authMiddleware);

  // GET /library/games
  // Returns the user's combined game library across steam, xbox, and psn,
  // sorted by most recently updated, with limit/offset pagination.
  //
  // Optional filter query params (combine any of them):
  //   ?id=<uuid>            exact match
  //   ?title=<text>         case-insensitive partial match
  //   ?platform=steam|xbox|playstation
  //   ?status=backlog|in-progress|completed|retired
  app.get("/games", async (c) => {
    const userId = c.get("userId");

    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    const { filter, error } = parseGameFilter({
      id: c.req.query("id"),
      title: c.req.query("title"),
      platform: c.req.query("platform"),
      status: c.req.query("status"),
    });

    if (error) {
      return c.json({ status: "ERROR", message: error }, 400);
    }

    try {
      const library = await libraryService.getUserGames(userId, filter);
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
      console.error(`[LibraryController] Failed to fetch games:`, error);
      throw error;
    }
  });

  // POST /library/enrich-covers
  app.post("/enrich-covers", async (c) => {
    const userId = c.get("userId");

    try {
      libraryService
        .enrichGameCovers(userId)
        .then((result) => {
          console.log(
            `[LibraryController] Cover enrichment complete: ${result.enriched} enriched, ${result.noMatch} skipped`,
          );
        })
        .catch((err) => {
          console.error("[LibraryController] Cover enrichment failed:", err);
        });

      return c.json(
        {
          status: "SUCCESS",
          message: "Cover enrichment started in background.",
        },
        200,
      );
    } catch (error) {
      console.error(
        "[LibraryController] Failed to start cover enrichment:",
        error,
      );
      throw error;
    }
  });

  // GET /library/stats
  app.get("/stats", async (c) => {
    const userId = c.get("userId");

    try {
      const stats = await libraryService.getStats(userId);

      return c.json(
        {
          status: "SUCCESS",
          data: stats,
        },
        200,
      );
    } catch (error) {
      console.error(`[LibraryController] Failed to fetch stats:`, error);
      throw error;
    }
  });

  // GET /library/games/:gameId/achievements
  // Fetches achievements/trophies for a single game, resolving the correct
  // platform service (steam/xbox/psn) from the game's stored platform.
  //
  //   ?filter=all|unlocked|locked
  //   ?sort=unlock-date|name|rarity
  //   ?limit=<number>   ?offset=<number>
  app.get("/games/:gameId/achievements", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    const { options, error } = parseAchievementOptions({
      filter: c.req.query("filter"),
      sort: c.req.query("sort"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    if (error) {
      return c.json({ status: "ERROR", message: error }, 400);
    }

    try {
      const { data, total, unlocked } =
        await libraryService.getGameAchievements(userId, gameId, options);

      return c.json(
        {
          status: "SUCCESS",
          meta: {
            total,
            limit: options.limit,
            offset: options.offset,
            unlocked,
          },
          data,
        },
        200,
      );
    } catch (err) {
      if (err instanceof GameNotFoundError) {
        return c.json({ status: "ERROR", message: err.message }, 404);
      }
      console.error(
        `[LibraryController] Failed to fetch achievements for game ${gameId}:`,
        err,
      );
      throw err;
    }
  });

  // POST /library/games/:gameId/achievements/sync
  // Forces a fresh achievement/trophy sync for one game, dispatched to
  // whichever platform (steam/xbox/psn) it belongs to.
  app.post("/games/:gameId/achievements/sync", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    try {
      const result = await libraryService.syncGameAchievements(userId, gameId);

      return c.json(
        {
          status: "SUCCESS",
          message: `Synced ${result.synced} achievement(s).`,
          data: result,
        },
        200,
      );
    } catch (err) {
      if (err instanceof GameNotFoundError) {
        return c.json({ status: "ERROR", message: err.message }, 404);
      }
      console.error(
        `[LibraryController] Failed to sync achievements for game ${gameId}:`,
        err,
      );
      throw err;
    }
  });

  return app;
};
