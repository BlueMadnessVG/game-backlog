import { eq } from "drizzle-orm";
import { SteamSyncSchema } from "@repo/shared";

import { steamAccounts, users } from "../../db/schema";
import type { DbClient } from "../../db";
import type { SteamProvider } from "../../providers/steam.provider";
import type {
  AchievementsOutcome,
  OwnedGame,
  PlatformAdapter,
} from "./platform-adapter";

type SteamAccount = { steamId: string };
type SteamLinkBody = { steamId: string };

/**
 * Steam, as far as the platform engine is concerned: which API to call and how
 * to turn its answers into {@link OwnedGame}s and achievements.
 */
export class SteamAdapter
  implements PlatformAdapter<SteamAccount, SteamLinkBody>
{
  readonly platform = "steam" as const;
  readonly batch = { size: 5, delayMs: 200 };
  // Steam serves its own cover art.
  readonly enrichCovers = false;
  readonly linkSchema = SteamSyncSchema;

  constructor(private readonly provider: SteamProvider) {}

  async link(db: DbClient, userId: string, body: SteamLinkBody) {
    const profile = await this.provider.getPlayerSummary(body.steamId);
    if (!profile) {
      throw new Error(`Could not find Steam profile for ID: ${body.steamId}`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: profile.displayName })
        .where(eq(users.id, userId));

      await tx
        .insert(steamAccounts)
        .values({
          userId,
          steamId: profile.steamId,
          lastSync: new Date(),
        })
        .onConflictDoUpdate({
          target: steamAccounts.userId,
          set: { steamId: profile.steamId, lastSync: new Date() },
        });
    });

    return profile;
  }

  async loadAccount(db: DbClient, userId: string) {
    const [account] = await db
      .select({ steamId: steamAccounts.steamId })
      .from(steamAccounts)
      .where(eq(steamAccounts.userId, userId))
      .limit(1);
    return account ?? null;
  }

  async fetchOwnedGames(account: SteamAccount): Promise<OwnedGame[]> {
    const owned = await this.provider.getOwnedGames(account.steamId);

    return owned.map((game) => ({
      externalId: game.steamAppId,
      title: game.name,
      iconUrl: game.iconUrl,
      coverUrl: game.coverUrl,
      bannerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/library_hero.jpg`,
      playTimeMinutes: game.playtimeMinutes,
      lastPlayedAt: game.lastPlayedAt,
      // Steam reports completion through the achievements, not the library list.
      completionPercentage: null,
    }));
  }

  async fetchAchievements(
    account: SteamAccount,
    game: { externalId: string },
  ): Promise<AchievementsOutcome> {
    const [player, definitions] = await Promise.all([
      this.provider.getPlayerAchievements(account.steamId, game.externalId),
      this.provider.getGameSchema(game.externalId),
    ]);

    if (definitions.status !== "ok") return definitions;
    // The game defines achievements but the player's side is unavailable
    // (private profile, no stats page): we can't say anything about it.
    if (!player) return { status: "error" };

    return {
      status: "ok",
      achievements: player.map((a) => {
        const meta = definitions.schema.get(a.apiName);
        return {
          externalKey: a.apiName,
          name: meta?.displayName ?? a.name,
          description: meta?.description ?? a.description ?? null,
          hidden: meta?.hidden ?? false,
          iconUrl: meta?.iconUrl ?? null,
          iconGrayUrl: meta?.iconGrayUrl ?? null,
          globalPercentage: meta?.globalPercentage ?? null,
          points: null,
          tier: null,
          achieved: a.achieved,
          unlockedAt: a.unlockedAt,
        };
      }),
    };
  }
}
