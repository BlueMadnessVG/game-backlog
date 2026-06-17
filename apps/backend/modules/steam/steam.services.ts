import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  steamAccounts,
  steamGames,
  games,
  achievements,
  userAchievements,
} from "../../db/schema";
import type { DbClient } from "../../db";
import { SteamProvider } from "../../providers/steam.provider";
import { sql } from "drizzle-orm";
import type {
  Achievement,
  AchievementFilter,
  AchievementSort,
  Game,
} from "@repo/shared";
import { deriveGameStatus } from "./steam.utils";

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

  async getUserGame(userId: string, gameId: string): Promise<Game | null> {
    const [row] = await this.db
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
      .where(and(eq(steamAccounts.userId, userId), eq(games.id, gameId)))
      .limit(1);

    if (!row) return null;

    return {
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
    };
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

    const insertedGames = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(games)
        .values(
          steamGamesList.map((g) => ({
            title: g.name,
            platform: "steam" as const,
            iconUrl: g.iconUrl,
            coverUrl: g.coverUrl,
            bannerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${g.steamAppId}/library_hero.jpg`,
            playTime: g.playtimeMinutes,
            lastPlayedAt: g.lastPlayedAt,
            status: deriveGameStatus({
              completionPercentage: 0,
              hasAchievements: true, // corrected below after achievement sync
              playTimeMinutes: g.playtimeMinutes,
              lastPlayedAt: g.lastPlayedAt ?? null,
            }),
          })),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: {
            coverUrl: sql`excluded.cover_url`,
            iconUrl: sql`excluded.icon_url`,
            bannerUrl: sql`excluded.banner_url`,
            playTime: sql`excluded.play_time`,
            lastPlayedAt: sql`excluded.last_played_at`,
            status: sql`excluded.status`,
          },
        })
        .returning();

      const steamToInternalMap = inserted.map((gameRecord) => {
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

      return inserted;
    });

    return insertedGames;
  }

  async syncAllGameAchievements(localUserId: string, gameIds: string[]) {
    const BATCH_SIZE = 5;
    const DELAY_MS = 200;

    for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
      const batch = gameIds.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((gameId) =>
          this.syncGameAchievements(localUserId, gameId).catch((err) => {
            // Don't let one failed game abort the whole sync
            console.warn(
              `[SteamService] Achievement sync skipped for game ${gameId}:`,
              err,
            );
          }),
        ),
      );

      if (i + BATCH_SIZE < gameIds.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }
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

    if (!row)
      throw new Error(
        `No Steam mapping found for game ${gameId} / user ${localUserId}`,
      );

    const [playerAchievements, schemaMap] = await Promise.all([
      this.provider.getPlayerAchievements(row.steamId, row.steamAppId),
      this.provider.getGameSchema(row.steamAppId),
    ]);

    if (!playerAchievements) return [];

    return await this.db.transaction(async (tx) => {
      const achievementValues = playerAchievements.map((a) => {
        const meta = schemaMap.get(a.apiName);
        return {
          steamAppId: row.steamAppId,
          apiName: a.apiName,
          name: meta?.displayName ?? a.name,
          description: meta?.description ?? a.description ?? null,
          hidden: meta?.hidden ?? false,
          iconUrl: meta?.iconUrl ?? null,
          iconGrayUrl: meta?.iconGrayUrl ?? null,
          globalPercentage: meta?.globalPercentage ?? null,
        };
      });

      const upsertedAchievements = await tx
        .insert(achievements)
        .values(achievementValues)
        .onConflictDoUpdate({
          target: [achievements.steamAppId, achievements.apiName],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            hidden: sql`excluded.hidden`,
            iconUrl: sql`excluded.icon_url`,
            iconGrayUrl: sql`excluded.icon_gray_url`,
            globalPercentage: sql`excluded.global_percentage`,
          },
        })
        .returning();

      const apiNameToId = new Map(
        upsertedAchievements.map((a) => [a.apiName, a.id]),
      );

      const userAchievementValues = playerAchievements
        .map((a) => {
          const achievementId = apiNameToId.get(a.apiName);
          if (!achievementId) return null;
          return {
            userId: localUserId,
            achievementId,
            achieved: a.achieved,
            unlockedAt: a.unlockedAt,
          };
        })
        .filter(Boolean) as {
        userId: string;
        achievementId: string;
        achieved: boolean;
        unlockedAt: Date | null;
      }[];

      await tx
        .insert(userAchievements)
        .values(userAchievementValues)
        .onConflictDoUpdate({
          target: [userAchievements.userId, userAchievements.achievementId],
          set: {
            achieved: sql`excluded.achieved`,
            unlockedAt: sql`excluded.unlocked_at`,
          },
        });

      const totalCount = playerAchievements.length;
      const achievedCount = playerAchievements.filter((a) => a.achieved).length;
      const completionPercentage =
        totalCount > 0 ? (achievedCount / totalCount) * 100 : 0;

      // Fetch current playtime + lastPlayedAt so deriveGameStatus has full context.
      // Done inside the transaction so we read the row as it stands right now.
      const [gameRow] = await tx
        .select({
          playTime: games.playTime,
          lastPlayedAt: games.lastPlayedAt,
        })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      const refinedStatus = deriveGameStatus({
        completionPercentage,
        hasAchievements: totalCount > 0,
        playTimeMinutes: gameRow?.playTime ?? 0,
        lastPlayedAt: gameRow?.lastPlayedAt ?? null,
      });

      await tx
        .update(games)
        .set({
          completionPercentage,
          status: refinedStatus,
        })
        .where(eq(games.id, gameId));

      return upsertedAchievements;
    });
  }

  async getGameAchievements(
    userId: string,
    gameId: string,
    options: {
      filter?: AchievementFilter;
      sort?: AchievementSort;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ data: Achievement[]; total: number; unlocked: number }> {
    const { filter = "all", sort = "rarity", limit = 50, offset = 0 } = options;

    const [existing] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievementId),
      )
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(
            achievements.steamAppId,
            sql`(
            select steam_app_id from steam_games where game_id = ${gameId}
          )`,
          ),
        ),
      );

    if (!existing || existing.count === 0) {
      await this.syncGameAchievements(userId, gameId);
    }

    const filterConditions = and(
      eq(userAchievements.userId, userId),
      eq(
        achievements.steamAppId,
        sql`(
        select steam_app_id from steam_games where game_id = ${gameId}
      )`,
      ),
      filter === "unlocked" ? eq(userAchievements.achieved, true) : undefined,
      filter === "locked" ? eq(userAchievements.achieved, false) : undefined,
    );

    const sortOrder =
      sort === "rarity"
        ? desc(achievements.globalPercentage)
        : sort === "unlock-date"
          ? desc(userAchievements.unlockedAt)
          : asc(achievements.name);

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: achievements.id,
          apiName: achievements.apiName,
          gameId: steamGames.gameId,
          name: achievements.name,
          description: achievements.description,
          hidden: achievements.hidden,
          iconUrl: achievements.iconUrl,
          iconGrayUrl: achievements.iconGrayUrl,
          achieved: userAchievements.achieved,
          unlockedAt: userAchievements.unlockedAt,
          globalPercentage: achievements.globalPercentage,
          addedAt: achievements.createdAt,
          updatedAt: achievements.updatedAt,
        })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(achievements.id, userAchievements.achievementId),
        )
        .innerJoin(
          steamGames,
          eq(steamGames.steamAppId, achievements.steamAppId),
        )
        .where(filterConditions)
        .orderBy(sortOrder)
        .limit(limit)
        .offset(offset),

      this.db
        .select({
          total: sql<number>`count(*)::int`,
          unlocked: sql<number>`sum(case when ${userAchievements.achieved} then 1 else 0 end)::int`,
        })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(achievements.id, userAchievements.achievementId),
        )
        .where(filterConditions),
    ]);

    const { total, unlocked } = totals[0] ?? { total: 0, unlocked: 0 };

    const data: Achievement[] = rows.map((row) => ({
      id: row.id,
      externalId: row.apiName,
      gameId: row.gameId,
      name: row.name,
      description: row.description ?? null,
      hidden: row.hidden ?? false,
      iconUrl: row.iconUrl ?? null,
      iconGrayUrl: row.iconGrayUrl ?? null,
      achieved: row.achieved ?? false,
      unlockedAt: row.unlockedAt?.toISOString() ?? null,
      globalPercentage: row.globalPercentage ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total, unlocked };
  }
}
