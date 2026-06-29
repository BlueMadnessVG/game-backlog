import { Hono } from "hono";
import { LibraryService } from "./library.services";

type Bindings = {
  Variables: {
    userId: string;
  };
};

export const createLibraryController = (libraryService: LibraryService) => {
  const app = new Hono<Bindings>();

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
