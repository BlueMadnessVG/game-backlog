import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  psnAccounts,
  psnGames,
  psnTrophies,
  psnUserTrophies,
  games,
} from "../../db/schema";
import type { DbClient } from "../../db";
import { PsnProvider } from "../../providers/psn.provider";
import { sql } from "drizzle-orm";
import type {
  Achievement,
  AchievementFilter,
  AchievementSort,
  Game,
} from "@repo/shared";
import { deriveGameStatus } from "./psn.utils";
import { deleteGameAndRelations } from "../../lib/game-deletion.utils";

const BATCH_SIZE = 5;
const DELAY_MS = 500;

export class PsnService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: PsnProvider,
  ) {}

  // ── Token management ──────────────────────────────────────────────────────

  private async getValidAccessToken(localUserId: string): Promise<string> {
    const [account] = await this.db
      .select({
        accessToken: psnAccounts.accessToken,
        refreshToken: psnAccounts.refreshToken,
        accessTokenExpiresAt: psnAccounts.accessTokenExpiresAt,
      })
      .from(psnAccounts)
      .where(eq(psnAccounts.userId, localUserId))
      .limit(1);

    if (!account) {
      throw new Error(
        `No PSN account linked for user ${localUserId} — sync required`,
      );
    }

    const expiresAt = account.accessTokenExpiresAt.getTime();
    const isExpired = Date.now() >= expiresAt - 60_000;

    if (!isExpired) {
      return account.accessToken;
    }

    console.log(
      `[PsnService] Access token expired for user ${localUserId}, refreshing...`,
    );
    const newTokens = await this.provider.refreshTokens(account.refreshToken);

    await this.db
      .update(psnAccounts)
      .set({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        accessTokenExpiresAt: new Date(newTokens.accessTokenExpiresAt),
      })
      .where(eq(psnAccounts.userId, localUserId));

    return newTokens.accessToken;
  }

  // ── READ ──────────────────────────────────────────────────────────────────

  async getUserGames(localUserId: string): Promise<Game[]> {
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
        npCommunicationId: psnGames.npCommunicationId,
      })
      .from(games)
      .innerJoin(psnGames, eq(games.id, psnGames.gameId))
      .innerJoin(psnAccounts, eq(psnAccounts.userId, localUserId))
      .where(eq(psnAccounts.userId, localUserId))
      .orderBy(desc(games.completionPercentage));

    return rows.map((row) => ({
      id: row.id,
      externalId: row.npCommunicationId,
      title: row.title,
      platform: row.platform ?? "playstation",
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

  async getUserGame(localUserId: string, gameId: string): Promise<Game | null> {
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
        npCommunicationId: psnGames.npCommunicationId,
      })
      .from(games)
      .innerJoin(psnGames, eq(games.id, psnGames.gameId))
      .innerJoin(psnAccounts, eq(psnAccounts.userId, localUserId))
      .where(and(eq(psnAccounts.userId, localUserId), eq(games.id, gameId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      externalId: row.npCommunicationId,
      title: row.title,
      platform: row.platform ?? "playstation",
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

  // ── SYNC — Profile ────────────────────────────────────────────────────────

  async syncUserProfile(localUserId: string, npsso: string, onlineId: string) {
    const tokens = await this.provider.exchangeNpsso(npsso);

    const profile = await this.provider.getProfile(
      tokens.accessToken,
      onlineId,
    );

    if (!profile) {
      throw new Error(`Could not find PSN profile for online ID: ${onlineId}`);
    }

    return await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: profile.onlineId })
        .where(eq(users.id, localUserId));

      await tx
        .insert(psnAccounts)
        .values({
          userId: localUserId,
          accountId: profile.accountId,
          onlineId: profile.onlineId,
          avatarUrl: profile.avatarUrl,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
          lastSync: new Date(),
        })
        .onConflictDoUpdate({
          target: psnAccounts.userId,
          set: {
            accountId: profile.accountId,
            onlineId: profile.onlineId,
            avatarUrl: profile.avatarUrl,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
            lastSync: new Date(),
          },
        });

      return { ...profile, tokens };
    });
  }

  // ── SYNC — Games ──────────────────────────────────────────────────────────

  async syncUserGames(localUserId: string) {
    const accessToken = await this.getValidAccessToken(localUserId);
    const titleList = await this.provider.getOwnedGames(accessToken);
    if (!titleList.length) return [];

    const deduplicated = Array.from(
      titleList
        .reduce((map, title) => {
          const existing = map.get(title.npCommunicationId);
          if (!existing) {
            map.set(title.npCommunicationId, title);
          } else {
            if (title.completionPercentage > existing.completionPercentage) {
              map.set(title.npCommunicationId, title);
            }
          }
          return map;
        }, new Map<string, (typeof titleList)[number]>())
        .values(),
    );

    return await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(games)
        .values(
          deduplicated.map((g) => {
            const lastPlayedAt = g.lastUpdatedDateTime
              ? new Date(g.lastUpdatedDateTime)
              : null;

            return {
              title: g.name,
              platform: "playstation" as const,
              iconUrl: g.iconUrl,
              playTime: 0,
              lastPlayedAt,
              completionPercentage: g.completionPercentage,
              status: deriveGameStatus({
                completionPercentage: g.completionPercentage,
                hasAchievements: true,
                playTimeMinutes: 0,
                lastPlayedAt,
                platinumEarned: g.platinumEarned,
              }),
            };
          }),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: {
            iconUrl: sql`excluded.icon_url`,
            lastPlayedAt: sql`excluded.last_played_at`,
            completionPercentage: sql`excluded.completion_percentage`,
            status: sql`excluded.status`,
          },
        })
        .returning();

      const psnToInternalMap = inserted.map((gameRecord) => {
        const psnGame = deduplicated.find((t) => t.name === gameRecord.title);
        return {
          gameId: gameRecord.id,
          npCommunicationId: psnGame!.npCommunicationId,
          trophyTitlePlatform: psnGame!.trophyTitlePlatform,
          npServiceName: psnGame!.npServiceName,
        };
      });

      await tx.insert(psnGames).values(psnToInternalMap).onConflictDoNothing();

      await tx
        .update(psnAccounts)
        .set({ lastSync: new Date() })
        .where(eq(psnAccounts.userId, localUserId));

      return inserted;
    });
  }

  // ── SYNC — Trophies ───────────────────────────────────────────────────────

  async syncAllGameTrophies(localUserId: string, gameIds: string[]) {
    for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
      const batch = gameIds.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((gameId) =>
          this.syncGameTrophies(localUserId, gameId).catch((err) => {
            console.warn(
              `[PsnService] Trophy sync skipped for game ${gameId}:`,
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

  async syncGameTrophies(localUserId: string, gameId: string) {
    const [row] = await this.db
      .select({
        npCommunicationId: psnGames.npCommunicationId,
        npServiceName: psnGames.npServiceName,
      })
      .from(psnGames)
      .where(eq(psnGames.gameId, gameId))
      .limit(1);

    if (!row) {
      throw new Error(
        `No PSN mapping found for game ${gameId} / user ${localUserId}`,
      );
    }

    const accessToken = await this.getValidAccessToken(localUserId);

    const result = await this.provider.getGameTrophies(
      accessToken,
      row.npCommunicationId,
      (row.npServiceName ?? "trophy2") as "trophy" | "trophy2",
    );

    if (result.status === "error") {
      // Transient fetch/auth failure — leave the game as-is.
      return [];
    }

    if (result.status === "empty") {
      console.debug(
        `[PsnService] Game ${gameId} (${row.npCommunicationId}) has zero trophies — removing from library`,
      );
      await deleteGameAndRelations(this.db, gameId);
      return [];
    }

    const trophyList = result.trophies;

    return await this.db.transaction(async (tx) => {
      const trophyValues = trophyList.map((t) => ({
        npCommunicationId: row.npCommunicationId,
        trophyId: t.trophyId,
        name: t.name,
        detail: t.detail ?? null,
        trophyType: t.trophyType,
        trophyHidden: t.trophyHidden,
        trophyIconUrl: t.trophyIconUrl ?? null,
        trophyEarnedRate: t.trophyEarnedRate ?? null,
      }));

      const upsertedTrophies = await tx
        .insert(psnTrophies)
        .values(trophyValues)
        .onConflictDoUpdate({
          target: [psnTrophies.npCommunicationId, psnTrophies.trophyId],
          set: {
            name: sql`excluded.name`,
            detail: sql`excluded.detail`,
            trophyType: sql`excluded.trophy_type`,
            trophyHidden: sql`excluded.trophy_hidden`,
            trophyIconUrl: sql`excluded.trophy_icon_url`,
            trophyEarnedRate: sql`excluded.trophy_earned_rate`,
          },
        })
        .returning();

      const trophyIdToUuid = new Map(
        upsertedTrophies.map((t) => [t.trophyId, t.id]),
      );

      const userTrophyValues = trophyList
        .map((t) => {
          const trophyUuid = trophyIdToUuid.get(t.trophyId);
          if (!trophyUuid) return null;
          return {
            userId: localUserId,
            trophyId: trophyUuid,
            earned: t.earned,
            earnedDateTime: t.earnedDateTime,
          };
        })
        .filter(Boolean) as {
        userId: string;
        trophyId: string;
        earned: boolean;
        earnedDateTime: Date | null;
      }[];

      await tx
        .insert(psnUserTrophies)
        .values(userTrophyValues)
        .onConflictDoUpdate({
          target: [psnUserTrophies.userId, psnUserTrophies.trophyId],
          set: {
            earned: sql`excluded.earned`,
            earnedDateTime: sql`excluded.earned_date_time`,
          },
        });

      const totalCount = trophyList.length;
      const earnedCount = trophyList.filter((t) => t.earned).length;
      const completionPercentage =
        totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

      const platinumEarned = trophyList.some(
        (t) => t.trophyType === "platinum" && t.earned,
      );

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
        platinumEarned,
      });

      await tx
        .update(games)
        .set({ completionPercentage, status: refinedStatus })
        .where(eq(games.id, gameId));

      return upsertedTrophies;
    });
  }

  // ── READ — Trophies (with lazy sync) ─────────────────────────────────────

  async getGameTrophies(
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
      .from(psnUserTrophies)
      .innerJoin(psnTrophies, eq(psnTrophies.id, psnUserTrophies.trophyId))
      .where(
        and(
          eq(psnUserTrophies.userId, userId),
          eq(
            psnTrophies.npCommunicationId,
            sql`(select np_communication_id from psn_games where game_id = ${gameId})`,
          ),
        ),
      );

    if (!existing || existing.count === 0) {
      await this.syncGameTrophies(userId, gameId);
    }

    const filterConditions = and(
      eq(psnUserTrophies.userId, userId),
      eq(
        psnTrophies.npCommunicationId,
        sql`(select np_communication_id from psn_games where game_id = ${gameId})`,
      ),
      filter === "unlocked" ? eq(psnUserTrophies.earned, true) : undefined,
      filter === "locked" ? eq(psnUserTrophies.earned, false) : undefined,
    );

    const sortOrder =
      sort === "rarity"
        ? desc(psnTrophies.trophyEarnedRate)
        : sort === "unlock-date"
          ? desc(psnUserTrophies.earnedDateTime)
          : asc(psnTrophies.name);

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: psnTrophies.id,
          trophyId: psnTrophies.trophyId,
          gameId: psnGames.gameId,
          name: psnTrophies.name,
          detail: psnTrophies.detail,
          trophyType: psnTrophies.trophyType,
          trophyHidden: psnTrophies.trophyHidden,
          trophyIconUrl: psnTrophies.trophyIconUrl,
          earned: psnUserTrophies.earned,
          earnedDateTime: psnUserTrophies.earnedDateTime,
          trophyEarnedRate: psnTrophies.trophyEarnedRate,
          addedAt: psnTrophies.createdAt,
          updatedAt: psnTrophies.updatedAt,
        })
        .from(psnUserTrophies)
        .innerJoin(psnTrophies, eq(psnTrophies.id, psnUserTrophies.trophyId))
        .innerJoin(
          psnGames,
          eq(psnGames.npCommunicationId, psnTrophies.npCommunicationId),
        )
        .where(filterConditions)
        .orderBy(sortOrder)
        .limit(limit)
        .offset(offset),

      this.db
        .select({
          total: sql<number>`count(*)::int`,
          unlocked: sql<number>`sum(case when ${psnUserTrophies.earned} then 1 else 0 end)::int`,
        })
        .from(psnUserTrophies)
        .innerJoin(psnTrophies, eq(psnTrophies.id, psnUserTrophies.trophyId))
        .where(filterConditions),
    ]);

    const { total, unlocked } = totals[0] ?? { total: 0, unlocked: 0 };

    const data: Achievement[] = rows.map((row) => ({
      id: row.id,
      externalId: row.trophyId,
      gameId: row.gameId,
      name: row.name,
      description: row.detail ?? null,
      hidden: row.trophyHidden ?? false,
      iconUrl: row.trophyIconUrl ?? null,
      iconGrayUrl: null,
      achieved: row.earned ?? false,
      unlockedAt: row.earnedDateTime?.toISOString() ?? null,
      globalPercentage: row.trophyEarnedRate ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total, unlocked };
  }
}
