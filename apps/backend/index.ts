import { db } from "./db";
import { createApp } from "./app";
import { SteamProvider } from "./providers/steam.provider";
import { XboxProvider } from "./providers/xbox.provider";
import { PsnProvider } from "./providers/psn.provider";
import { IgdbProvider } from "./providers/igdb.provider";
import { GoogleOAuthProvider } from "./providers/google.provider";
import { DiscordOAuthProvider } from "./providers/discord.provider";

/**
 * Production entry point: reads the environment, builds the real external
 * clients, hands them to the app factory (app.ts) and starts serving.
 */
const app = createApp({
  db,
  providers: {
    steam: new SteamProvider(process.env.STEAM_API_KEY!),
    xbox: new XboxProvider(process.env.OPENXBL_API_KEY!),
    psn: new PsnProvider(),
    igdb: new IgdbProvider(
      process.env.IGDB_CLIENT_ID!,
      process.env.IGDB_CLIENT_SECRET!,
    ),
    google: new GoogleOAuthProvider(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!,
    ),
    discord: new DiscordOAuthProvider(
      process.env.DISCORD_CLIENT_ID!,
      process.env.DISCORD_CLIENT_SECRET!,
      process.env.DISCORD_REDIRECT_URI!,
    ),
  },
});

/**
 * Bun-native execution
 */
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};

/**
 * Graceful shutdown
 */
process.on("SIGTERM", async () => {
  console.log("🛰️ COMMAND CENTER: Initiating shutdown...");
  process.exit(0);
});

console.log(
  `🚀 COMMAND CENTER LIVE: http://localhost:${process.env.PORT || 3000}`,
);
