import { Hono } from "hono";
import { LibraryService } from "./library.services";

type Bindings = {
  Variables: {
    userId: string;
  };
};

export const createLibraryController = (libraryService: LibraryService) => {
  const app = new Hono<Bindings>();

  // GET /library/games
  // Returns the user's combined game library across steam, xbox, and psn,
  // sorted by most recently updated, with limit/offset pagination.
  app.get("/games", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    try {
      const library = await libraryService.getUserGames(userId);
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
  // Fire-and-forget — IGDB is rate-limited to 4 req/sec, so this runs in the
  // background and could take a while for large Xbox/PSN libraries.
  app.post("/enrich-covers", async (c) => {
    const userId = "8234858e-0f4b-4860-9f5e-26f633355462";

    try {
      libraryService
        .enrichGameCovers(userId)
        .then((result) => {
          console.log(
            `[LibraryController] Cover enrichment complete: ${result.enriched} enriched, ${result.skipped} skipped`,
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
  // Returns totalGames, overallCompletion, achievements, and completedGames
  // broken down per platform + combined total
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
