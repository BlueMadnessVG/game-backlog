import { ConfigError, loadConfig } from "./config";

/**
 * Production entry point: checks the environment, builds the real external
 * clients, hands them to the app factory (app.ts) and starts serving.
 *
 * The environment is validated BEFORE anything else is imported. Static imports
 * are hoisted, and several modules (db, jwt, encryption) read their config as
 * they load, so importing them first would fail on the first missing variable
 * instead of reporting all of them.
 */
function loadConfigOrExit() {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfigOrExit();

const { db } = await import("./db");
const { createApp } = await import("./app");
const { SteamProvider } = await import("./providers/steam.provider");
const { XboxProvider } = await import("./providers/xbox.provider");
const { PsnProvider } = await import("./providers/psn.provider");
const { IgdbProvider } = await import("./providers/igdb.provider");
const { GoogleOAuthProvider } = await import("./providers/google.provider");
const { DiscordOAuthProvider } = await import("./providers/discord.provider");

const { providers } = config;

const app = createApp({
  db,
  providers: {
    steam: new SteamProvider(providers.steamApiKey),
    xbox: new XboxProvider(providers.openxblApiKey),
    psn: new PsnProvider(),
    igdb: new IgdbProvider(providers.igdbClientId, providers.igdbClientSecret),
    google: new GoogleOAuthProvider(
      providers.googleClientId,
      providers.googleClientSecret,
      providers.googleRedirectUri,
    ),
    discord: new DiscordOAuthProvider(
      providers.discordClientId,
      providers.discordClientSecret,
      providers.discordRedirectUri,
    ),
  },
});

const { port } = config.server;

/**
 * Bun-native execution
 */
export default {
  port,
  fetch: app.fetch,
};

/**
 * Graceful shutdown
 */
process.on("SIGTERM", async () => {
  console.log("🛰️ COMMAND CENTER: Initiating shutdown...");
  process.exit(0);
});

console.log(`🚀 COMMAND CENTER LIVE: http://localhost:${port}`);
