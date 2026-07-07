import { Hono } from "hono";
import { LibraryService, type GameLibraryFilter } from "./library.services";

type Bindings = {
  Variables: {
    userId: string;
  };
};

const VALID_PLATFORMS = ["steam", "xbox", "playstation"] as const;
const VALID_STATUSES = [
  "backlog",
  "in-progress",
  "completed",
  "retired",
] as const;

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

export const createLibraryController = (libraryService: LibraryService) => {
  const app = new Hono<Bindings>();

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
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

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
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

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
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

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

  return app;
};
