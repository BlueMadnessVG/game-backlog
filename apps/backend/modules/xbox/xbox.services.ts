import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  xboxAccounts,
  xboxGames,
  xboxAchievements,
  xboxUserAchievements,
  games,
} from "../../db/schema";
import type { DbClient } from "../../db";
import { XboxProvider } from "../../providers/xbox.provider";
import { sql } from "drizzle-orm";
import type {
  Achievement,
  AchievementFilter,
  AchievementSort,
  Game,
} from "@repo/shared";
import { deriveGameStatus } from "./xbox.utils";

const BATCH_SIZE = 5;
const DELAY_MS = 500;

export class XboxService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: XboxProvider,
  ) {}

  // -------------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------------

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
        titleId: xboxGames.titleId,
      })
      .from(games)
      .innerJoin(xboxGames, eq(games.id, xboxGames.gameId))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userId))
      .where(eq(xboxAccounts.userId, userId))
      .orderBy(desc(games.playTime));

    return rows.map((row) => ({
      id: row.id,
      externalId: row.titleId,
      title: row.title,
      platform: row.platform ?? "xbox",
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
        titleId: xboxGames.titleId,
      })
      .from(games)
      .innerJoin(xboxGames, eq(games.id, xboxGames.gameId))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userId))
      .where(and(eq(xboxAccounts.userId, userId), eq(games.id, gameId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      externalId: row.titleId,
      title: row.title,
      platform: row.platform ?? "xbox",
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

  // -------------------------------------------------------------------------
  // SYNC — Profile
  // -------------------------------------------------------------------------

  async syncUserProfile(localUserId: string, xuid: string) {
    const xboxData = await this.provider.getPlayerProfile(xuid);

    if (!xboxData) {
      throw new Error(`Could not find Xbox profile for XUID: ${xuid}`);
    }

    return await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: xboxData.gamertag })
        .where(eq(users.id, localUserId));

      await tx
        .insert(xboxAccounts)
        .values({
          userId: localUserId,
          xuid: xboxData.xuid,
          gamertag: xboxData.gamertag,
          lastSync: new Date(),
        })
        .onConflictDoUpdate({
          target: xboxAccounts.userId,
          set: {
            gamertag: xboxData.gamertag,
            lastSync: new Date(),
          },
        });

      return xboxData;
    });
  }

  // -------------------------------------------------------------------------
  // SYNC — Games
  // -------------------------------------------------------------------------

  async syncUserGames(localUserId: string, xuid: string) {
    const titleList = await this.provider.getOwnedGames(xuid);
    if (!titleList.length) return [];

    const titleIds = titleList.map((t) => t.titleId);
    const playtimeMap = await this.provider.getPlaytimeMinutes(xuid, titleIds);

    const titlesWithPlaytime = titleList.map((t) => ({
      ...t,
      playtimeMinutes: playtimeMap.get(t.titleId) ?? 0,
    }));

    const deduplicatedTitles = Array.from(
      titlesWithPlaytime
        .reduce((map, title) => {
          const existing = map.get(title.name);
          if (!existing) {
            map.set(title.name, title);
          } else {
            const existingTime = existing.lastPlayedAt?.getTime() ?? 0;
            const currentTime = title.lastPlayedAt?.getTime() ?? 0;
            if (currentTime > existingTime) {
              map.set(title.name, title);
            }
          }
          return map;
        }, new Map<string, (typeof titlesWithPlaytime)[number]>())
        .values(),
    );

    const insertedGames = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(games)
        .values(
          deduplicatedTitles.map((g) => ({
            title: g.name,
            platform: "xbox" as const,
            coverUrl: g.coverUrl,
            bannerUrl: g.coverUrl,
            playTime: g.playtimeMinutes,
            lastPlayedAt: g.lastPlayedAt,
            completionPercentage: g.completionPercentage,
            status: deriveGameStatus({
              completionPercentage: g.completionPercentage,
              hasAchievements: true,
              playTimeMinutes: g.playtimeMinutes,
              lastPlayedAt: g.lastPlayedAt ?? null,
            }),
          })),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: {
            coverUrl: sql`excluded.cover_url`,
            bannerUrl: sql`excluded.banner_url`,
            playTime: sql`excluded.play_time`,
            lastPlayedAt: sql`excluded.last_played_at`,
            completionPercentage: sql`excluded.completion_percentage`,
            status: sql`excluded.status`,
          },
        })
        .returning();

      const xboxToInternalMap = inserted.map((gameRecord) => {
        const xboxGame = deduplicatedTitles.find(
          // ✅ use deduplicatedTitles
          (t) => t.name === gameRecord.title,
        );
        return {
          gameId: gameRecord.id,
          titleId: xboxGame!.titleId,
        };
      });

      await tx
        .insert(xboxGames)
        .values(xboxToInternalMap)
        .onConflictDoNothing();

      await tx
        .update(xboxAccounts)
        .set({ lastSync: new Date() })
        .where(eq(xboxAccounts.xuid, xuid));

      return inserted;
    });

    return insertedGames;
  }

  // -------------------------------------------------------------------------
  // SYNC — Achievements (batched, fire-and-forget safe)
  // -------------------------------------------------------------------------

  async syncAllGameAchievements(localUserId: string, gameIds: string[]) {
    for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
      const batch = gameIds.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((gameId) =>
          this.syncGameAchievements(localUserId, gameId).catch((err) => {
            console.warn(
              `[XboxService] Achievement sync skipped for game ${gameId}:`,
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
        titleId: xboxGames.titleId,
        xuid: xboxAccounts.xuid,
      })
      .from(xboxGames)
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, localUserId))
      .where(eq(xboxGames.gameId, gameId))
      .limit(1);

    if (!row)
      throw new Error(
        `No Xbox mapping found for game ${gameId} / user ${localUserId}`,
      );

    const playerAchievements = await this.provider.getPlayerAchievements(
      row.xuid,
      row.titleId,
    );

    if (!playerAchievements) return [];

    return await this.db.transaction(async (tx) => {
      const achievementValues = playerAchievements.map((a) => ({
        titleId: row.titleId,
        apiName: a.apiName,
        name: a.name,
        description: a.description ?? null,
        isSecret: a.isSecret ?? false,
        iconUrl: a.iconUrl ?? null,
        gamerscore: a.gamerscore ?? 0,
        globalPercentage: a.globalPercentage ?? null,
      }));

      const upsertedAchievements = await tx
        .insert(xboxAchievements)
        .values(achievementValues)
        .onConflictDoUpdate({
          target: [xboxAchievements.titleId, xboxAchievements.apiName],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            isSecret: sql`excluded.is_secret`,
            iconUrl: sql`excluded.icon_url`,
            gamerscore: sql`excluded.gamerscore`,
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
        .insert(xboxUserAchievements)
        .values(userAchievementValues)
        .onConflictDoUpdate({
          target: [
            xboxUserAchievements.userId,
            xboxUserAchievements.achievementId,
          ],
          set: {
            achieved: sql`excluded.achieved`,
            unlockedAt: sql`excluded.unlocked_at`,
          },
        });

      const totalCount = playerAchievements.length;
      const achievedCount = playerAchievements.filter((a) => a.achieved).length;
      const completionPercentage =
        totalCount > 0 ? (achievedCount / totalCount) * 100 : 0;

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
        .set({ completionPercentage, status: refinedStatus })
        .where(eq(games.id, gameId));

      return upsertedAchievements;
    });
  }

  // -------------------------------------------------------------------------
  // READ — Achievements (with lazy sync on first access)
  // -------------------------------------------------------------------------

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

    // Lazy sync — if no achievement rows exist yet, fetch from Xbox now
    const [existing] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(xboxUserAchievements)
      .innerJoin(
        xboxAchievements,
        eq(xboxAchievements.id, xboxUserAchievements.achievementId),
      )
      .where(
        and(
          eq(xboxUserAchievements.userId, userId),
          eq(
            xboxAchievements.titleId,
            sql`(select title_id from xbox_games where game_id = ${gameId})`,
          ),
        ),
      );

    if (!existing || existing.count === 0) {
      await this.syncGameAchievements(userId, gameId);
    }

    const filterConditions = and(
      eq(xboxUserAchievements.userId, userId),
      eq(
        xboxAchievements.titleId,
        sql`(select title_id from xbox_games where game_id = ${gameId})`,
      ),
      filter === "unlocked"
        ? eq(xboxUserAchievements.achieved, true)
        : undefined,
      filter === "locked"
        ? eq(xboxUserAchievements.achieved, false)
        : undefined,
    );

    const sortOrder =
      sort === "rarity"
        ? desc(xboxAchievements.globalPercentage)
        : sort === "unlock-date"
          ? desc(xboxUserAchievements.unlockedAt)
          : asc(xboxAchievements.name);

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: xboxAchievements.id,
          apiName: xboxAchievements.apiName,
          gameId: xboxGames.gameId,
          name: xboxAchievements.name,
          description: xboxAchievements.description,
          isSecret: xboxAchievements.isSecret,
          iconUrl: xboxAchievements.iconUrl,
          gamerscore: xboxAchievements.gamerscore,
          achieved: xboxUserAchievements.achieved,
          unlockedAt: xboxUserAchievements.unlockedAt,
          globalPercentage: xboxAchievements.globalPercentage,
          addedAt: xboxAchievements.createdAt,
          updatedAt: xboxAchievements.updatedAt,
        })
        .from(xboxUserAchievements)
        .innerJoin(
          xboxAchievements,
          eq(xboxAchievements.id, xboxUserAchievements.achievementId),
        )
        .innerJoin(xboxGames, eq(xboxGames.titleId, xboxAchievements.titleId))
        .where(filterConditions)
        .orderBy(sortOrder)
        .limit(limit)
        .offset(offset),

      this.db
        .select({
          total: sql<number>`count(*)::int`,
          unlocked: sql<number>`sum(case when ${xboxUserAchievements.achieved} then 1 else 0 end)::int`,
        })
        .from(xboxUserAchievements)
        .innerJoin(
          xboxAchievements,
          eq(xboxAchievements.id, xboxUserAchievements.achievementId),
        )
        .where(filterConditions),
    ]);

    const { total, unlocked } = totals[0] ?? { total: 0, unlocked: 0 };

    // Map to the shared Achievement type — Xbox-specific fields (gamerscore, isSecret)
    // map to the closest shared equivalents (hidden, iconGrayUrl left null)
    const data: Achievement[] = rows.map((row) => ({
      id: row.id,
      externalId: row.apiName,
      gameId: row.gameId,
      name: row.name,
      description: row.description ?? null,
      hidden: row.isSecret ?? false, // isSecret → hidden (shared type)
      iconUrl: row.iconUrl ?? null,
      iconGrayUrl: null, // Xbox doesn't have a locked/gray variant
      achieved: row.achieved ?? false,
      unlockedAt: row.unlockedAt?.toISOString() ?? null,
      globalPercentage: row.globalPercentage ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total, unlocked };
  }
}
