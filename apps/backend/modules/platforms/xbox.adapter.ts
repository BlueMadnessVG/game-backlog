import { eq } from "drizzle-orm";
import { XboxSyncSchema } from "@repo/shared";

import { users, xboxAccounts } from "../../db/schema";
import type { DbClient } from "../../db";
import type { XboxProvider } from "../../providers/xbox.provider";
import type {
  AchievementsOutcome,
  OwnedGame,
  PlatformAdapter,
} from "./platform-adapter";

type XboxAccount = { xuid: string };
type XboxLinkBody = { xuid: string };

/**
 * Xbox, as far as the platform engine is concerned: which OpenXBL calls to
 * make and how to turn their answers into {@link OwnedGame}s and achievements.
 */
export class XboxAdapter implements PlatformAdapter<XboxAccount, XboxLinkBody> {
  readonly platform = "xbox" as const;
  readonly batch = { size: 5, delayMs: 500 };
  // OpenXBL has no usable cover art, so covers come from IGDB.
  readonly enrichCovers = true;
  readonly linkSchema = XboxSyncSchema;

  constructor(private readonly provider: XboxProvider) {}

  async link(db: DbClient, userId: string, body: XboxLinkBody) {
    const profile = await this.provider.getPlayerProfile(body.xuid);
    if (!profile) {
      throw new Error(`Could not find Xbox profile for XUID: ${body.xuid}`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: profile.gamertag })
        .where(eq(users.id, userId));

      await tx
        .insert(xboxAccounts)
        .values({
          userId,
          xuid: profile.xuid,
          gamertag: profile.gamertag,
          lastSync: new Date(),
        })
        .onConflictDoUpdate({
          target: xboxAccounts.userId,
          set: {
            xuid: profile.xuid,
            gamertag: profile.gamertag,
            lastSync: new Date(),
          },
        });
    });

    return profile;
  }

  async loadAccount(db: DbClient, userId: string) {
    const [account] = await db
      .select({ xuid: xboxAccounts.xuid })
      .from(xboxAccounts)
      .where(eq(xboxAccounts.userId, userId))
      .limit(1);
    return account ?? null;
  }

  async fetchOwnedGames(account: XboxAccount): Promise<OwnedGame[]> {
    const titles = await this.provider.getOwnedGames(account.xuid);
    if (!titles.length) return [];

    // The title history has no play time; it comes from a separate stats call.
    const playtime = await this.provider.getPlaytimeMinutes(
      account.xuid,
      titles.map((t) => t.titleId),
    );

    return titles.map((title) => ({
      externalId: title.titleId,
      title: title.name,
      iconUrl: null,
      coverUrl: title.coverUrl,
      bannerUrl: null,
      playTimeMinutes: playtime.get(title.titleId) ?? 0,
      lastPlayedAt: title.lastPlayedAt,
      completionPercentage: title.completionPercentage,
    }));
  }

  async fetchAchievements(
    account: XboxAccount,
    game: { externalId: string },
  ): Promise<AchievementsOutcome> {
    const result = await this.provider.getPlayerAchievements(
      account.xuid,
      game.externalId,
    );
    if (result.status !== "ok") return result;

    return {
      status: "ok",
      achievements: result.achievements.map((a) => ({
        externalKey: a.apiName,
        name: a.name,
        description: a.description,
        hidden: a.isSecret,
        iconUrl: a.iconUrl,
        iconGrayUrl: null,
        globalPercentage: a.globalPercentage,
        points: a.gamerscore,
        tier: null,
        achieved: a.achieved,
        unlockedAt: a.unlockedAt,
      })),
    };
  }
}
