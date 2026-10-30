import { Hono } from "hono";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { requestId } from "hono/request-id";

import { corsMiddleware } from "./middleware/cors.middleware";

import { db } from "./db";
import { SteamProvider } from "./providers/steam.provider";
import { SteamAdapter } from "./modules/platforms/steam.adapter";
import {
  PlatformLibrary,
  type AchievementPage,
  type AchievementQuery,
  type PlatformAchievements,
} from "./modules/platforms/platform-library";
import { createPlatformController } from "./modules/platforms/platform.controller";
import { XboxProvider } from "./providers/xbox.provider";
import { XboxAdapter } from "./modules/platforms/xbox.adapter";
import { errorHandler } from "./middleware/error.handler";
import { PsnProvider } from "./providers/psn.provider";
import { PsnService } from "./modules/psn/psn.services";
import { createPsnController } from "./modules/psn/psn.controller";
import { LibraryService } from "./modules/library/library.services";
import { createLibraryController } from "./modules/library/library.controller";
import { IgdbProvider } from "./providers/igdb.provider";
import { GoogleOAuthProvider } from "./providers/google.provider";
import { DiscordOAuthProvider } from "./providers/discord.provider";
import { AuthService } from "./modules/auth/auth.services";
import { createAuthController } from "./modules/auth/auth.controller";

/**
 * 1. Dependency Injection / Composition Root
 * We initialize the entire tree here. This makes testing easy.
 */
const steamProvider = new SteamProvider(process.env.STEAM_API_KEY!);
const steamLibrary = new PlatformLibrary(db, new SteamAdapter(steamProvider));

const xboxProvider = new XboxProvider(process.env.OPENXBL_API_KEY!);
const xboxLibrary = new PlatformLibrary(db, new XboxAdapter(xboxProvider));

const psnProvider = new PsnProvider();
const psnService = new PsnService(db, psnProvider);

const igdbProvider = new IgdbProvider(
  process.env.IGDB_CLIENT_ID!,
  process.env.IGDB_CLIENT_SECRET!,
);

// TEMPORARY: PSN still has its own module. The wrapper goes away when it
// moves onto the platform engine.
const legacyPlatform = (
  read: (u: string, g: string, q?: AchievementQuery) => Promise<AchievementPage>,
  sync: (u: string, g: string) => Promise<unknown[]>,
): PlatformAchievements => ({
  getAchievements: read,
  syncAchievements: async (u, g) => ({ synced: (await sync(u, g)).length }),
});

const libraryService = new LibraryService(db, igdbProvider, {
  steam: steamLibrary,
  xbox: xboxLibrary,
  playstation: legacyPlatform(
    (u, g, q) => psnService.getGameTrophies(u, g, q),
    (u, g) => psnService.syncGameTrophies(u, g),
  ),
});

const googleProvider = new GoogleOAuthProvider(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!,
);

const discordProvider = new DiscordOAuthProvider(
  process.env.DISCORD_CLIENT_ID!,
  process.env.DISCORD_CLIENT_SECRET!,
  process.env.DISCORD_REDIRECT_URI!,
);

const authService = new AuthService(db, {
  google: googleProvider,
  discord: discordProvider,
});

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
app.use("*", corsMiddleware);

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

apiV1.route(
  "/steam",
  createPlatformController({
    library: steamLibrary,
    libraryService,
    authService,
  }),
);
apiV1.route(
  "/xbox",
  createPlatformController({
    library: xboxLibrary,
    libraryService,
    authService,
  }),
);
apiV1.route(
  "/psn",
  createPsnController(psnService, libraryService, authService),
);

apiV1.route("/library", createLibraryController(libraryService, authService));

apiV1.route("/auth", createAuthController(authService));

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
