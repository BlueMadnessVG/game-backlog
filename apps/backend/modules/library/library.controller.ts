import { Hono } from "hono";
import { LibraryService, type GameLibraryFilter } from "./library.services";
import { ValidationError } from "../../lib/errors";

import { createAuthMiddleware } from "../../middleware/auth.middleware";
import type { AuthService } from "../auth/auth.services";

type Bindings = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const MAX_PAGE_SIZE = 100;

const VALID_PLATFORMS = ["steam", "xbox", "playstation"] as const;
const VALID_STATUSES = [
  "backlog",
  "in-progress",
  "completed",
  "retired",
] as const;

const VALID_ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const VALID_ACHIEVEMENT_SORTS = ["unlock-date", "name", "rarity"] as const;

/** A bad query-string value, reported against the field that carried it. */
const invalid = (field: string, message: string) =>
  new ValidationError(message, [{ path: field, message }]);

function parseGameFilter(
  query: Record<string, string | undefined>,
): GameLibraryFilter {
  const filter: GameLibraryFilter = {};

  if (query.id) filter.id = query.id;
  if (query.title) filter.title = query.title;

  if (query.platform) {
    if (!VALID_PLATFORMS.includes(query.platform as any)) {
      throw invalid(
        "platform",
        `Invalid platform "${query.platform}". Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      );
    }
    filter.platform = query.platform as GameLibraryFilter["platform"];
  }

  if (query.status) {
    if (!VALID_STATUSES.includes(query.status as any)) {
      throw invalid(
        "status",
        `Invalid status "${query.status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }
    filter.status = query.status as GameLibraryFilter["status"];
  }

  return filter;
}

function parseAchievementOptions(query: Record<string, string | undefined>): {
  filter?: (typeof VALID_ACHIEVEMENT_FILTERS)[number];
  sort?: (typeof VALID_ACHIEVEMENT_SORTS)[number];
  limit: number;
  offset: number;
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
      throw invalid(
        "filter",
        `Invalid filter "${query.filter}". Must be one of: ${VALID_ACHIEVEMENT_FILTERS.join(", ")}`,
      );
    }
    options.filter = query.filter as (typeof VALID_ACHIEVEMENT_FILTERS)[number];
  }

  if (query.sort) {
    if (!VALID_ACHIEVEMENT_SORTS.includes(query.sort as any)) {
      throw invalid(
        "sort",
        `Invalid sort "${query.sort}". Must be one of: ${VALID_ACHIEVEMENT_SORTS.join(", ")}`,
      );
    }
    options.sort = query.sort as (typeof VALID_ACHIEVEMENT_SORTS)[number];
  }

  return options;
}

export const createLibraryController = (
  libraryService: LibraryService,
  authService: AuthService,
) => {
  const app = new Hono<Bindings>();

  app.use("*", createAuthMiddleware(authService));

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

    const limit = Math.min(Number(c.req.query("limit")) || 50, MAX_PAGE_SIZE);
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    const filter = parseGameFilter({
      id: c.req.query("id"),
      title: c.req.query("title"),
      platform: c.req.query("platform"),
      status: c.req.query("status"),
    });

    const { games, total } = await libraryService.getUserGames(userId, filter, {
      limit,
      offset,
    });

    return c.json(
      {
        status: "SUCCESS",
        meta: { total, limit, offset },
        data: games,
      },
      200,
    );
  });

  // POST /library/enrich-covers
  app.post("/enrich-covers", async (c) => {
    const userId = c.get("userId");

    // Background work: the response doesn't wait for it.
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
  });

  // GET /library/stats
  app.get("/stats", async (c) => {
    const userId = c.get("userId");

    const stats = await libraryService.getStats(userId);

    return c.json({ status: "SUCCESS", data: stats }, 200);
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

    const options = parseAchievementOptions({
      filter: c.req.query("filter"),
      sort: c.req.query("sort"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    const { data, total, unlocked } = await libraryService.getGameAchievements(
      userId,
      gameId,
      options,
    );

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
  });

  // POST /library/games/:gameId/achievements/sync
  // Forces a fresh achievement/trophy sync for one game, dispatched to
  // whichever platform (steam/xbox/psn) it belongs to.
  app.post("/games/:gameId/achievements/sync", async (c) => {
    const userId = c.get("userId");
    const gameId = c.req.param("gameId");

    const result = await libraryService.syncGameAchievements(userId, gameId);

    return c.json(
      {
        status: "SUCCESS",
        message: `Synced ${result.synced} achievement(s).`,
        data: result,
      },
      200,
    );
  });

  return app;
};
