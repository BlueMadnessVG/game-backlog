import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  xboxAccounts,
  xboxGames,
  xboxAchievements,
  xboxUserAchievements,
  games,
  userGames,
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
import { deleteGameAndRelations } from "../../lib/game-deletion.utils";

const BATCH_SIZE = 5;
const DELAY_MS = 500;

export class XboxGameNotFoundError extends Error {
  constructor(
    public readonly gameId: string,
    public readonly userId: string,
  ) {
    super(
      `No Xbox game found for game ${gameId} and user ${userId} — the game may not be an Xbox title, the user may not own it, or their Xbox account isn't linked`,
    );
    this.name = "XboxGameNotFoundError";
  }
}

type GameRow = {
  id: string;
  title: string;
  platform: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  status: "backlog" | "in-progress" | "completed" | "retired";
  playTime: number;
  completionPercentage: number;
  lastPlayedAt: Date | null;
  addedAt: Date;
  updatedAt: Date;
  titleId: string;
};

export class XboxService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: XboxProvider,
  ) {}

  // -------------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------------

  private mapRowToGame(row: GameRow): Game {
    return {
      id: row.id,
      externalId: row.titleId,
      title: row.title,
      platform: (row.platform ?? "xbox") as Game["platform"],
      status: row.status,
      iconUrl: row.iconUrl ?? null,
      coverUrl: row.coverUrl ?? null,
      bannerUrl: row.bannerUrl ?? null,
      playTime: row.playTime,
      completionPercentage: row.completionPercentage,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const rows = await this.db
      .select({
        id: games.id,
        title: games.title,
        platform: games.platform,
        iconUrl: games.iconUrl,
        coverUrl: games.coverUrl,
        bannerUrl: games.bannerUrl,
        status: userGames.status,
        playTime: userGames.playTime,
        completionPercentage: userGames.completionPercentage,
        lastPlayedAt: userGames.lastPlayedAt,
        addedAt: userGames.createdAt,
        updatedAt: userGames.updatedAt,
        titleId: xboxGames.titleId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(xboxGames, eq(xboxGames.gameId, games.id))
      .where(eq(userGames.userId, userId))
      .orderBy(desc(userGames.playTime));

    return rows.map((row) => this.mapRowToGame(row));
  }

  async getUserGame(userId: string, gameId: string): Promise<Game | null> {
    const [row] = await this.db
      .select({
        id: games.id,
        title: games.title,
        platform: games.platform,
        iconUrl: games.iconUrl,
        coverUrl: games.coverUrl,
        bannerUrl: games.bannerUrl,
        status: userGames.status,
        playTime: userGames.playTime,
        completionPercentage: userGames.completionPercentage,
        lastPlayedAt: userGames.lastPlayedAt,
        addedAt: userGames.createdAt,
        updatedAt: userGames.updatedAt,
        titleId: xboxGames.titleId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(xboxGames, eq(xboxGames.gameId, games.id))
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .limit(1);

    if (!row) return null;

    return this.mapRowToGame(row);
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
          set: { gamertag: xboxData.gamertag, lastSync: new Date() },
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

    // Xbox can return multiple titleIds sharing the same display name
    // (e.g. an Xbox One and a Series X|S version of the same game) — this
    // collapses those to one, keeping whichever was played more recently.
    // Same underlying title-collision caveat as Steam still applies below
    // for two genuinely different games that happen to share an exact
    // title string; this dedup step only handles Xbox's specific case.
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

    return await this.db.transaction(async (tx) => {
      // 1. Upsert the shared catalog — title/platform/cover art only.
      const catalogRows = await tx
        .insert(games)
        .values(
          deduplicatedTitles.map((g) => ({
            title: g.name,
            platform: "xbox" as const,
            coverUrl: g.coverUrl,
          })),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: {
            coverUrl: sql`coalesce(${games.coverUrl}, excluded.cover_url)`,
          },
        })
        .returning();

      const titleToGameId = new Map(
        catalogRows.map((row) => [row.title, row.id]),
      );

      const xboxMappingValues = deduplicatedTitles
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          return { gameId, titleId: g.titleId };
        })
        .filter((v): v is { gameId: string; titleId: string } => v !== null);

      if (xboxMappingValues.length > 0) {
        await tx
          .insert(xboxGames)
          .values(xboxMappingValues)
          .onConflictDoNothing();
      }

      // 3. Upsert this user's ownership + personal state.
      const userGameValues = deduplicatedTitles
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          return {
            userId: localUserId,
            gameId,
            playTime: g.playtimeMinutes,
            lastPlayedAt: g.lastPlayedAt,
            completionPercentage: g.completionPercentage,
            status: deriveGameStatus({
              completionPercentage: g.completionPercentage,
              hasAchievements: true,
              playTimeMinutes: g.playtimeMinutes,
              lastPlayedAt: g.lastPlayedAt ?? null,
            }),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const upsertedUserGames = await tx
        .insert(userGames)
        .values(userGameValues)
        .onConflictDoUpdate({
          target: [userGames.userId, userGames.gameId],
          set: {
            playTime: sql`excluded.play_time`,
            lastPlayedAt: sql`excluded.last_played_at`,
            completionPercentage: sql`excluded.completion_percentage`,
            status: sql`excluded.status`,
          },
        })
        .returning();

      await tx
        .update(xboxAccounts)
        .set({ lastSync: new Date() })
        .where(eq(xboxAccounts.xuid, xuid));

      return upsertedUserGames;
    });
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
    // Real ownership check: only resolves when a userGames row ties this
    // exact user to this exact game. The old version joined xboxAccounts
    // by userId alone with no tie back to the game, so it resolved for
    // any authenticated user asking about any game in the shared catalog.
    const [row] = await this.db
      .select({
        titleId: xboxGames.titleId,
        xuid: xboxAccounts.xuid,
      })
      .from(userGames)
      .innerJoin(xboxGames, eq(xboxGames.gameId, userGames.gameId))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userGames.userId))
      .where(
        and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
      )
      .limit(1);

    if (!row) {
      throw new XboxGameNotFoundError(gameId, localUserId);
    }

    const result = await this.provider.getPlayerAchievements(
      row.xuid,
      row.titleId,
    );

    if (result.status === "error") {
      return [];
    }

    if (result.status === "empty") {
      console.debug(
        `[XboxService] Game ${gameId} (title ${row.titleId}) has zero achievements — removing from library`,
      );
      // Removes the game from the shared catalog for every owner, not just
      // localUserId — pre-existing behavior, unchanged by this pass. Same
      // open question as Steam: needs deleteGameAndRelations confirmed to
      // also clean up userGames (or rely on the new FK cascade).
      await deleteGameAndRelations(this.db, gameId);
      return [];
    }

    const playerAchievements = result.achievements;

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

      // Read this user's own playtime/lastPlayedAt from userGames, not the
      // shared games row.
      const [userGameRow] = await tx
        .select({
          playTime: userGames.playTime,
          lastPlayedAt: userGames.lastPlayedAt,
        })
        .from(userGames)
        .where(
          and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
        )
        .limit(1);

      const refinedStatus = deriveGameStatus({
        completionPercentage,
        hasAchievements: totalCount > 0,
        playTimeMinutes: userGameRow?.playTime ?? 0,
        lastPlayedAt: userGameRow?.lastPlayedAt ?? null,
      });

      await tx
        .update(userGames)
        .set({ completionPercentage, status: refinedStatus })
        .where(
          and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
        );

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

    // Correlated subquery replaced with a direct join to xboxGames,
    // scoped by gameId — same fix as Steam's equivalent method.
    const [existing] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(xboxUserAchievements)
      .innerJoin(
        xboxAchievements,
        eq(xboxAchievements.id, xboxUserAchievements.achievementId),
      )
      .innerJoin(xboxGames, eq(xboxGames.titleId, xboxAchievements.titleId))
      .where(
        and(
          eq(xboxUserAchievements.userId, userId),
          eq(xboxGames.gameId, gameId),
        ),
      );

    if (!existing || existing.count === 0) {
      // If this user doesn't own gameId, this throws XboxGameNotFoundError
      // and propagates out — achievements for an unowned game are never
      // returned.
      await this.syncGameAchievements(userId, gameId);
    }

    const filterConditions = and(
      eq(xboxUserAchievements.userId, userId),
      eq(xboxGames.gameId, gameId),
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

      // Was missing the xboxGames join entirely — filterConditions
      // referencing xboxGames.gameId would have silently thrown or
      // resolved against the wrong table without it, since the old
      // per-query subquery didn't need a join but this shared
      // filterConditions object now does.
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
        .innerJoin(xboxGames, eq(xboxGames.titleId, xboxAchievements.titleId))
        .where(filterConditions),
    ]);

    const { total, unlocked } = totals[0] ?? { total: 0, unlocked: 0 };

    const data: Achievement[] = rows.map((row) => ({
      id: row.id,
      externalId: row.apiName,
      gameId: row.gameId,
      name: row.name,
      description: row.description ?? null,
      hidden: row.isSecret ?? false,
      iconUrl: row.iconUrl ?? null,
      iconGrayUrl: null,
      achieved: row.achieved ?? false,
      unlockedAt: row.unlockedAt?.toISOString() ?? null,
      globalPercentage: row.globalPercentage ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total, unlocked };
  }
}
