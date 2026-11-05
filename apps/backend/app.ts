import { Hono } from "hono";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { requestId } from "hono/request-id";

import { corsMiddleware } from "./middleware/cors.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.handler";
import type { DbClient } from "./db";
import type { AdvisoryLockClient } from "./lib/locks";
import { SteamAdapter } from "./modules/platforms/steam.adapter";
import { XboxAdapter } from "./modules/platforms/xbox.adapter";
import { PsnAdapter } from "./modules/platforms/psn.adapter";
import { PlatformLibrary } from "./modules/platforms/platform-library";
import { createPlatformController } from "./modules/platforms/platform.controller";
import { LibraryService } from "./modules/library/library.services";
import { createLibraryController } from "./modules/library/library.controller";
import { AuthService } from "./modules/auth/auth.services";
import { createAuthController } from "./modules/auth/auth.controller";

/**
 * Everything the app talks to that lives outside this process. Production
 * passes the real clients (index.ts); a test passes fakes for the external
 * services and a real in-memory database, and gets the exact same app.
 */
export interface AppDeps {
  db: DbClient;
  providers: {
    steam: ConstructorParameters<typeof SteamAdapter>[0];
    xbox: ConstructorParameters<typeof XboxAdapter>[0];
    psn: ConstructorParameters<typeof PsnAdapter>[0];
    igdb: ConstructorParameters<typeof LibraryService>[1];
    google: ConstructorParameters<typeof AuthService>[1]["google"];
    discord: ConstructorParameters<typeof AuthService>[1]["discord"];
  };
  /** Advisory-lock client; defaults to Postgres (needs DATABASE_URL). */
  lock?: AdvisoryLockClient;
}

/**
 * Composition root: builds the services, the middleware pipeline and the
 * routes. Pure construction — no listening, no env reads.
 */
export function createApp({ db, providers, lock }: AppDeps) {
  const steamLibrary = new PlatformLibrary(db, new SteamAdapter(providers.steam), lock);
  const xboxLibrary = new PlatformLibrary(db, new XboxAdapter(providers.xbox), lock);
  const psnLibrary = new PlatformLibrary(
    db,
    new PsnAdapter(providers.psn, lock),
    lock,
  );

  const libraryService = new LibraryService(
    db,
    providers.igdb,
    {
      steam: steamLibrary,
      xbox: xboxLibrary,
      playstation: psnLibrary,
    },
    lock,
  );

  const authService = new AuthService(db, {
    google: providers.google,
    discord: providers.discord,
  });

  const app = new Hono<{
    Variables: {
      userId: string;
      requestId: string;
    };
  }>();

  // The "onion": order matters.
  app.use("*", requestId());
  app.use("*", timeout(10000));
  app.use("*", logger());
  app.use("*", corsMiddleware);

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

  const apiV1 = new Hono();

  for (const [path, library] of [
    ["/steam", steamLibrary],
    ["/xbox", xboxLibrary],
    ["/psn", psnLibrary],
  ] as const) {
    apiV1.route(
      path,
      createPlatformController({ library, libraryService, authService }),
    );
  }

  apiV1.route("/library", createLibraryController(libraryService, authService));
  apiV1.route("/auth", createAuthController(authService));

  app.route("/api/v1", apiV1);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}
