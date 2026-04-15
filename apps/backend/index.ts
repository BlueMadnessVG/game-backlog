import { Hono } from "hono";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { cors } from "hono/cors"; // Use Hono's native cors if possible
import { requestId } from "hono/request-id"; // Hono has a built-in one!

import { db } from "./db";
import { SteamProvider } from "./providers/steam.provider";
import { SteamService } from "./modules/steam/steam.services";
import { createSteamController } from "./modules/steam/steam.controller";
import { errorHandler } from "./middleware/error.handler";

/**
 * 1. Dependency Injection / Composition Root
 * We initialize the entire tree here. This makes testing easy.
 */
const steamProvider = new SteamProvider(process.env.VITE_STEAM_API_KEY!);
const steamService = new SteamService(db, steamProvider);

/**
 * 2. App Initialization
 */
const app = new Hono<{
  Variables: {
    userId: string;
    requestId: string;
  };
}>();

/**
 * 3. Middleware Pipeline
 * The "Onion" architecture. Order matters.
 */
app.use("*", requestId()); // Use the native middleware
app.use("*", timeout(10000));
app.use("*", logger());
app.use("*", cors()); // native CORS is more performant in Bun

/**
 * 4. Health & Diagnostics
 */
app.get("/health", (c) => {
  return c.json(
    {
      status: "OPERATIONAL",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    200,
  );
});

/**
 * 5. Route Registration
 */
const apiV1 = new Hono();

// Inject the initialized service into the controller
apiV1.route("/steam", createSteamController(steamService));

app.route("/api/v1", apiV1);

/**
 * 6. Error & Boundary Handling
 */
app.onError(errorHandler);
app.notFound((c) =>
  c.json(
    {
      error: "TARGET_NOT_FOUND",
      message: "Requested sector not found",
    },
    404,
  ),
);

/**
 * 7. Bun-Native Execution
 */
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};

/**
 * 8. Handle graceful shutdown
 */
process.on("SIGTERM", async () => {
  console.log("🛰️ COMMAND CENTER: Initiating shutdown...");
  // Close DB connections
  // await pool.end();
  process.exit(0);
});

console.log(
  `🚀 COMMAND CENTER LIVE: http://localhost:${process.env.PORT || 3000}`,
);
