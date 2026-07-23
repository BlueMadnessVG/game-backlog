import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  psnAccounts,
  psnGames,
  psnTrophies,
  psnUserTrophies,
  games,
  userGames,
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

export class PsnGameNotFoundError extends Error {
  constructor(
    public readonly gameId: string,
    public readonly userId: string,
  ) {
    super(
      `No PSN game found for game ${gameId} and user ${userId} — the game may not be a PSN title, the user may not own it, or their PSN account isn't linked`,
    );
    this.name = "PsnGameNotFoundError";
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
  npCommunicationId: string;
};

export class PsnService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: PsnProvider,
  ) {}

  // ── Token management ────────────────────────────────────────────────────
  // Unaffected by the ownership fix — this is already correctly scoped by
  // localUserId alone, with no game involved.

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

  // ── READ ────────────────────────────────────────────────────────────────

  private mapRowToGame(row: GameRow): Game {
    return {
      id: row.id,
      externalId: row.npCommunicationId,
      title: row.title,
      platform: (row.platform ?? "playstation") as Game["platform"],
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

  async getUserGames(localUserId: string): Promise<Game[]> {
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
        npCommunicationId: psnGames.npCommunicationId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(psnGames, eq(psnGames.gameId, games.id))
      .where(eq(userGames.userId, localUserId))
      .orderBy(desc(userGames.completionPercentage));

    return rows.map((row) => this.mapRowToGame(row));
  }

  async getUserGame(localUserId: string, gameId: string): Promise<Game | null> {
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
        npCommunicationId: psnGames.npCommunicationId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(psnGames, eq(psnGames.gameId, games.id))
      .where(
        and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
      )
      .limit(1);

    if (!row) return null;

    return this.mapRowToGame(row);
  }

  // ── SYNC — Profile ──────────────────────────────────────────────────────
  // Unaffected — account-only, no game involved.

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

  // ── SYNC — Games ────────────────────────────────────────────────────────

  async syncUserGames(localUserId: string) {
    const accessToken = await this.getValidAccessToken(localUserId);
    const titleList = await this.provider.getOwnedGames(accessToken);
    if (!titleList.length) return [];

    // Deduped by npCommunicationId (PSN's real external id) rather than
    // title — better than Steam/Xbox's title-based dedup, since this can't
    // collapse two genuinely different games that happen to share a name.
    const deduplicated = Array.from(
      titleList
        .reduce((map, title) => {
          const existing = map.get(title.npCommunicationId);
          if (!existing) {
            map.set(title.npCommunicationId, title);
          } else if (
            title.completionPercentage > existing.completionPercentage
          ) {
            map.set(title.npCommunicationId, title);
          }
          return map;
        }, new Map<string, (typeof titleList)[number]>())
        .values(),
    );

    return await this.db.transaction(async (tx) => {
      // 1. Upsert the shared catalog — title/platform/icon only.
      const catalogRows = await tx
        .insert(games)
        .values(
          deduplicated.map((g) => ({
            title: g.name,
            platform: "playstation" as const,
            iconUrl: g.iconUrl,
          })),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: { iconUrl: sql`excluded.icon_url` },
        })
        .returning();

      // Resolution back to a catalog row is still by title, even though
      // the input list itself was deduped by npCommunicationId — this is
      // the same limitation as Steam/Xbox: two different PSN games with an
      // identical title would still shadow each other at this step.
      const titleToGameId = new Map(
        catalogRows.map((row) => [row.title, row.id]),
      );

      // 2. Map each catalog row to its PSN identifiers.
      const psnMappingValues = deduplicated
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          return {
            gameId,
            npCommunicationId: g.npCommunicationId,
            trophyTitlePlatform: g.trophyTitlePlatform,
            npServiceName: g.npServiceName,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (psnMappingValues.length > 0) {
        await tx
          .insert(psnGames)
          .values(psnMappingValues)
          .onConflictDoNothing();
      }

      // 3. Upsert this user's ownership + personal state. playTime is
      //    always 0 here — PSN's API doesn't expose raw playtime, only
      //    trophy sync recency (lastUpdatedDateTime), so there's nothing
      //    per-user to report beyond what's already captured below.
      const userGameValues = deduplicated
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          const lastPlayedAt = g.lastUpdatedDateTime
            ? new Date(g.lastUpdatedDateTime)
            : null;
          return {
            userId: localUserId,
            gameId,
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
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const upsertedUserGames = await tx
        .insert(userGames)
        .values(userGameValues)
        .onConflictDoUpdate({
          target: [userGames.userId, userGames.gameId],
          set: {
            lastPlayedAt: sql`excluded.last_played_at`,
            completionPercentage: sql`excluded.completion_percentage`,
            status: sql`excluded.status`,
          },
        })
        .returning();

      await tx
        .update(psnAccounts)
        .set({ lastSync: new Date() })
        .where(eq(psnAccounts.userId, localUserId));

      return upsertedUserGames;
    });
  }

  // ── SYNC — Trophies ─────────────────────────────────────────────────────

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
    // Real ownership check. The original version here queried psnGames
    // alone with no user scoping whatsoever — meaning any authenticated
    // user could trigger a trophy sync for any PSN game in the shared
    // catalog using their own credentials, regardless of whether they
    // owned it. This is the most permissive instance of the bug across
    // all three platforms — Steam/Xbox at least attempted (incorrectly)
    // to scope by user; this didn't attempt it at all.
    const [row] = await this.db
      .select({
        npCommunicationId: psnGames.npCommunicationId,
        npServiceName: psnGames.npServiceName,
      })
      .from(userGames)
      .innerJoin(psnGames, eq(psnGames.gameId, userGames.gameId))
      .where(
        and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
      )
      .limit(1);

    if (!row) {
      throw new PsnGameNotFoundError(gameId, localUserId);
    }

    const accessToken = await this.getValidAccessToken(localUserId);

    const result = await this.provider.getGameTrophies(
      accessToken,
      row.npCommunicationId,
      (row.npServiceName ?? "trophy2") as "trophy" | "trophy2",
    );

    if (result.status === "error") {
      return [];
    }

    if (result.status === "empty") {
      console.debug(
        `[PsnService] Game ${gameId} (${row.npCommunicationId}) has zero trophies — removing from library`,
      );
      // Removes the game from the shared catalog for every owner, not
      // just localUserId — same open question as Steam/Xbox: needs
      // deleteGameAndRelations confirmed to also clean up userGames.
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
        platinumEarned,
      });

      await tx
        .update(userGames)
        .set({ completionPercentage, status: refinedStatus })
        .where(
          and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
        );

      return upsertedTrophies;
    });
  }

  // ── READ — Trophies (with lazy sync) ───────────────────────────────────

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

    // Correlated subquery replaced with a direct join to psnGames, scoped
    // by gameId — same fix applied to Steam and Xbox.
    const [existing] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(psnUserTrophies)
      .innerJoin(psnTrophies, eq(psnTrophies.id, psnUserTrophies.trophyId))
      .innerJoin(
        psnGames,
        eq(psnGames.npCommunicationId, psnTrophies.npCommunicationId),
      )
      .where(
        and(eq(psnUserTrophies.userId, userId), eq(psnGames.gameId, gameId)),
      );

    if (!existing || existing.count === 0) {
      // If this user doesn't own gameId, this throws PsnGameNotFoundError
      // and propagates out — trophies for an unowned game are never
      // returned.
      await this.syncGameTrophies(userId, gameId);
    }

    const filterConditions = and(
      eq(psnUserTrophies.userId, userId),
      eq(psnGames.gameId, gameId),
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

      // Was missing the psnGames join — needed now that filterConditions
      // references psnGames.gameId directly instead of a subquery. Same
      // fix applied to Xbox's equivalent totals query.
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          unlocked: sql<number>`sum(case when ${psnUserTrophies.earned} then 1 else 0 end)::int`,
        })
        .from(psnUserTrophies)
        .innerJoin(psnTrophies, eq(psnTrophies.id, psnUserTrophies.trophyId))
        .innerJoin(
          psnGames,
          eq(psnGames.npCommunicationId, psnTrophies.npCommunicationId),
        )
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
