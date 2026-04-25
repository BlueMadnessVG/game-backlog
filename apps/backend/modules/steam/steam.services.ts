import { eq, desc } from "drizzle-orm";
import { users, steamAccounts, steamGames, games } from "../../db/schema";
import type { DbClient } from "../../db";
import { SteamProvider } from "../../providers/steam.provider";
import { sql } from "drizzle-orm";
import type { Game } from "@repo/shared";
import { chunk } from "../../lib/chunk";

export class SteamService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: SteamProvider,
  ) {}

  async getUserGames(userId: string): Promise<Game[]> {
    const rows = await this.db
      .select({
        id: games.id,
        title: games.title,
        platform: games.platform,
        status: games.status,
        iconUrl: games.iconUrl,
        coverUrl: games.coverUrl,
        bannerUrl: games.bannerUrl,
        playTime: games.playTime,
        completionPercentage: games.completionPercentage,
        lastPlayedAt: games.lastPlayedAt,
        addedAt: games.createdAt,
        updatedAt: games.updatedAt,
        steamAppId: steamGames.steamAppId,
      })
      .from(games)
      .innerJoin(steamGames, eq(games.id, steamGames.gameId))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, userId))
      .where(eq(steamAccounts.userId, userId))
      .orderBy(desc(games.playTime));

    return rows.map((row) => ({
      id: row.id,
      externalId: row.steamAppId,
      title: row.title,
      platform: row.platform ?? "steam",
      status: row.status ?? "backlog",
      iconUrl: row.iconUrl ?? null,
      coverUrl: row.coverUrl ?? null,
      bannerUrl: row.bannerUrl ?? null,
      playTime: row.playTime ?? 0,
      completionPercentage: row.completionPercentage ?? 0,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async syncUserProfile(localUserId: string, steamId: string) {
    const steamData = await this.provider.getPlayerSummary(steamId);

    if (!steamData) {
      throw new Error(`Could not find Steam profile for ID: ${steamId}`);
    }

    return await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: steamData.displayName })
        .where(eq(users.id, localUserId));

      await tx
        .insert(steamAccounts)
        .values({
          userId: localUserId,
          steamId: steamData.steamId,
          lastSync: new Date(),
        })
        .onConflictDoUpdate({
          target: steamAccounts.userId,
          set: {
            lastSync: new Date(),
          },
        });

      return steamData;
    });
  }

  async syncUserGames(localUserId: string, steamId: string) {
    const steamGamesList = await this.provider.getOwnedGames(steamId);
    if (!steamGamesList.length) return [];

    return await this.db.transaction(async (tx) => {
      const insertedGames = await tx
        .insert(games)
        .values(
          steamGamesList.map((g) => ({
            title: g.name,
            platform: "steam" as const,
            iconUrl: g.iconUrl,
            coverUrl: g.coverUrl,
            playTime: g.playtimeMinutes,
            lastPlayedAt: g.lastPlayedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [games.title],
          set: {
            coverUrl: sql`excluded.cover_url`,
            iconUrl: sql`excluded.icon_url`,
            playTime: sql`excluded.play_time`,
            lastPlayedAt: sql`excluded.last_played_at`,
          },
        })
        .returning();

      const steamToInternalMap = insertedGames.map((gameRecord) => {
        const steamGame = steamGamesList.find(
          (sg) => sg.name === gameRecord.title,
        );
        return {
          gameId: gameRecord.id,
          steamAppId: String(steamGame!.steamAppId),
        };
      });

      await tx
        .insert(steamGames)
        .values(steamToInternalMap)
        .onConflictDoNothing();

      await tx
        .update(steamAccounts)
        .set({ lastSync: new Date() })
        .where(eq(steamAccounts.steamId, steamId));

      return insertedGames;
    });
  }

  async syncAllGameAchievements(localUserId: string) {
    // Get the user's steamId + all their games with steamAppIds in one query
    const [accountRow] = await this.db
      .select({ steamId: steamAccounts.steamId })
      .from(steamAccounts)
      .where(eq(steamAccounts.userId, localUserId))
      .limit(1);

    if (!accountRow)
      throw new Error(`No Steam account linked for user ${localUserId}`);

    const userGames = await this.db
      .select({ gameId: games.id, steamAppId: steamGames.steamAppId })
      .from(games)
      .innerJoin(steamGames, eq(steamGames.gameId, games.id))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, localUserId));

    if (!userGames.length) return { synced: 0, skipped: 0 };

    const BATCH_SIZE = 5;
    const batches = chunk(userGames, BATCH_SIZE);

    let synced = 0;
    let skipped = 0;

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async ({ gameId, steamAppId }) => {
          try {
            const data = await this.provider.getGameAchievements(
              accountRow.steamId,
              steamAppId,
            );
            return {
              gameId,
              completionPercentage: data?.completionPercentage ?? 0,
              ok: true,
            };
          } catch (error) {
            console.warn(
              `[SteamService] Skipping achievements for appId ${steamAppId}:`,
              error,
            );
            return { gameId, completionPercentage: 0, ok: false };
          }
        }),
      );

      const toUpdate = results.filter((r) => r.ok);

      await this.db.transaction(async (tx) => {
        for (const { gameId, completionPercentage } of toUpdate) {
          await tx
            .update(games)
            .set({ completionPercentage })
            .where(eq(games.id, gameId));

          completionPercentage !== null ? synced++ : skipped++;
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { synced, skipped };
  }

  async syncGameAchievements(localUserId: string, gameId: string) {
    const [row] = await this.db
      .select({
        steamAppId: steamGames.steamAppId,
        steamId: steamAccounts.steamId,
      })
      .from(steamGames)
      .innerJoin(steamAccounts, eq(steamAccounts.userId, localUserId))
      .where(eq(steamGames.gameId, gameId))
      .limit(1);

    if (!row) throw new Error(`No Steam mapping found for game ${gameId}`);

    const data = await this.provider.getGameAchievements(
      row.steamId,
      row.steamAppId,
    );

    if (data === null) {
      await this.db
        .update(games)
        .set({ completionPercentage: 0 })
        .where(eq(games.id, gameId));
      return { completionPercentage: 0, achievedCount: 0, totalCount: 0 };
    }

    await this.db
      .update(games)
      .set({ completionPercentage: data.completionPercentage })
      .where(eq(games.id, gameId));

    return data;
  }
}
