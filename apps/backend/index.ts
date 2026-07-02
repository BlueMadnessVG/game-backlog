import { Hono } from "hono";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { db } from "./db";
import { SteamProvider } from "./providers/steam.provider";
import { SteamService } from "./modules/steam/steam.services";
import { createSteamController } from "./modules/steam/steam.controller";
import { XboxProvider } from "./providers/xbox.provider";
import { XboxService } from "./modules/xbox/xbox.services";
import { createXboxController } from "./modules/xbox/xbox.controller";
import { errorHandler } from "./middleware/error.handler";
import { PsnProvider } from "./providers/psn.provider";
import { PsnService } from "./modules/psn/psn.services";
import { createPsnController } from "./modules/psn/psn.controller";
import { LibraryService } from "./modules/library/library.services";
import { createLibraryController } from "./modules/library/library.controller";
import { IgdbProvider } from "./providers/igdb.provider";

/**
 * 1. Dependency Injection / Composition Root
 * We initialize the entire tree here. This makes testing easy.
 */
const steamProvider = new SteamProvider(process.env.STEAM_API_KEY!);
const steamService = new SteamService(db, steamProvider);

const xboxProvider = new XboxProvider(process.env.OPENXBL_API_KEY!);
const xboxService = new XboxService(db, xboxProvider);

const psnProvider = new PsnProvider();
const psnService = new PsnService(db, psnProvider);

const igdbProvider = new IgdbProvider(
  process.env.IGDB_CLIENT_ID!,
  process.env.IGDB_CLIENT_SECRET!,
);

const libraryService = new LibraryService(db, igdbProvider);

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
app.use("*", requestId());
app.use("*", timeout(10000));
app.use("*", logger());
app.use("*", cors());

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

apiV1.route("/steam", createSteamController(steamService));
apiV1.route("/xbox", createXboxController(xboxService));
apiV1.route("/psn", createPsnController(psnService));

apiV1.route("/library", createLibraryController(libraryService));

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
  process.exit(0);
});

console.log(
  `🚀 COMMAND CENTER LIVE: http://localhost:${process.env.PORT || 3000}`,
);
