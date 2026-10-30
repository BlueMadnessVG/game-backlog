import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import {
  achievements,
  games,
  userAchievements,
  psnGames,
  psnUserTrophies,
  userGames,
} from "../../db/schema";
import type { DbClient } from "../../db";
import { withLock, type AdvisoryLockClient } from "../../lib/locks";
import type { Game, PlatformStats, Stats } from "@repo/shared";
import { IgdbProvider } from "../../providers/igdb.provider";
import { isVisibleInLibrary } from "../../lib/game-catalog";
import { GameNotFoundError } from "../platforms/errors";
import type { PlatformKey } from "../platforms/platform-adapter";
import type {
  AchievementPage,
  AchievementQuery,
  PlatformAchievements,
} from "../platforms/platform-library";

export { GameNotFoundError };

const IGDB_BATCH_SIZE = 4;
const IGDB_DELAY_MS = 1100;

export type GameLibraryFilter = {
  id?: string;
  title?: string;
  platform?: PlatformKey;
  status?: "backlog" | "in-progress" | "completed" | "retired";
};

export type LibraryPage = { limit: number; offset: number };

const EMPTY_PLATFORM_STATS: PlatformStats = {
  games: 0,
  completionPercentage: 0,
  achievements: 0,
  completedGames: 0,
};

/** Escapes LIKE wildcards so `?title=100%` matches a literal "100%". */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * Read side of the user's library: the games a user owns, their stats, and
 * the cross-platform dispatch for achievements.
 *
 * @remarks
 * Every read starts from the user's own `user_games` rows. That is the one
 * rule that keeps users apart: `games` and the platform mapping tables are a
 * catalog shared by everyone, and the per-user fields (status, play time,
 * completion, last played) live only on `user_games`. A query that reaches a
 * game any other way returns other users' data.
 */
export class LibraryService {
  constructor(
    private readonly db: DbClient,
    private readonly igdbProvider: IgdbProvider,
    /** Who serves achievements for each platform's games. */
    private readonly platforms: Record<PlatformKey, PlatformAchievements>,
    private readonly lock?: AdvisoryLockClient,
  ) {}

  // ── Games ─────────────────────────────────────────────────────────────────

  /**
   * Returns one page of the user's library across all platforms, newest
   * activity first, and the total number of games matching the filter.
   *
   * @param page - `limit`/`offset`, applied in SQL. Defaults to the first 50.
   */
  async getUserGames(
    userId: string,
    filter: GameLibraryFilter = {},
    page: LibraryPage = { limit: 50, offset: 0 },
  ): Promise<{ games: Game[]; total: number }> {
    const where = and(
      eq(userGames.userId, userId),
      isVisibleInLibrary,
      filter.id ? eq(games.id, filter.id) : undefined,
      filter.title
        ? ilike(games.title, `%${escapeLike(filter.title)}%`)
        : undefined,
      filter.platform ? eq(games.platform, filter.platform) : undefined,
      filter.status ? eq(userGames.status, filter.status) : undefined,
    );

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
        // A game maps to exactly one platform table (each has gameId as its
        // primary key), so at most one of these is non-null.
        // games.external_id is the platform's own id; PSN still keeps
        // theirs in a mapping table until it moves onto the platform engine.
        externalId: sql<string>`coalesce(${games.externalId}, ${psnGames.npCommunicationId}, '')`,
        total: sql<number>`(count(*) over())::int`,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .leftJoin(psnGames, eq(psnGames.gameId, games.id))
      .where(where)
      .orderBy(desc(userGames.updatedAt), asc(games.id))
      .limit(page.limit)
      .offset(page.offset);

    // An offset past the end returns no rows, so the window count is gone;
    // count separately so `total` stays correct.
    const total =
      rows[0]?.total ??
      (page.offset > 0 ? await this.countUserGames(where) : 0);

    return { games: rows.map((row) => this.mapRowToGame(row)), total };
  }

  private async countUserGames(where: ReturnType<typeof and>): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .where(where);
    return row?.total ?? 0;
  }

  private normalizeUrl(url: string | null): string | null {
    return url && url.trim() !== "" ? url : null;
  }

  private mapRowToGame(row: {
    id: string;
    title: string;
    platform: string | null;
    status: string;
    iconUrl: string | null;
    coverUrl: string | null;
    bannerUrl: string | null;
    playTime: number;
    completionPercentage: number;
    lastPlayedAt: Date | null;
    addedAt: Date;
    updatedAt: Date;
    externalId: string;
  }): Game {
    return {
      id: row.id,
      externalId: row.externalId,
      title: row.title,
      platform: (row.platform ?? "steam") as Game["platform"],
      status: row.status as Game["status"],
      iconUrl: this.normalizeUrl(row.iconUrl),
      coverUrl: this.normalizeUrl(row.coverUrl),
      bannerUrl: this.normalizeUrl(row.bannerUrl),
      playTime: row.playTime,
      completionPercentage: row.completionPercentage,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(userId: string): Promise<Stats> {
    const [gameStats, achievementCounts] = await Promise.all([
      this.getGameStatsByPlatform(userId),
      this.getAchievementCountsByPlatform(userId),
    ]);

    const platformStats = (key: PlatformKey): PlatformStats => ({
      ...(gameStats.get(key) ?? EMPTY_PLATFORM_STATS),
      achievements: achievementCounts[key],
    });
    const steam = platformStats("steam");
    const xbox = platformStats("xbox");
    const playstation = platformStats("playstation");

    const totalGames = steam.games + xbox.games + playstation.games;

    const total: PlatformStats = {
      games: totalGames,
      completionPercentage:
        totalGames > 0
          ? Math.round(
              ((steam.completionPercentage * steam.games +
                xbox.completionPercentage * xbox.games +
                playstation.completionPercentage * playstation.games) /
                totalGames) *
                10,
            ) / 10
          : 0,
      achievements:
        steam.achievements + xbox.achievements + playstation.achievements,
      completedGames:
        steam.completedGames + xbox.completedGames + playstation.completedGames,
    };

    return { total, breakdown: { steam, xbox, playstation } };
  }

  /** Per-platform game counts, from the user's own progress rows. */
  private async getGameStatsByPlatform(
    userId: string,
  ): Promise<Map<string, PlatformStats>> {
    const rows = await this.db
      .select({
        platform: games.platform,
        games: sql<number>`count(*)::int`,
        completionPercentage: sql<number>`round(coalesce(avg(${userGames.completionPercentage}), 0)::numeric, 1)::float`,
        completedGames: sql<number>`(count(*) filter (where ${userGames.status} = 'completed'))::int`,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .where(and(eq(userGames.userId, userId), isVisibleInLibrary))
      .groupBy(games.platform);

    return new Map(
      rows.map((row) => [
        row.platform ?? "",
        {
          games: row.games,
          completionPercentage: row.completionPercentage,
          completedGames: row.completedGames,
          achievements: 0,
        },
      ]),
    );
  }

  /** Unlocked achievements / earned trophies the user holds, per platform. */
  private async getAchievementCountsByPlatform(
    userId: string,
  ): Promise<Record<PlatformKey, number>> {
    const [unified, [playstation]] = await Promise.all([
      this.db
        .select({ platform: games.platform, n: sql<number>`count(*)::int` })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(achievements.id, userAchievements.achievementId),
        )
        .innerJoin(games, eq(games.id, achievements.gameId))
        .where(
          and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achieved, true),
          ),
        )
        .groupBy(games.platform),
      // PSN still keeps its trophies in their own table until it moves onto
      // the platform engine.
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(psnUserTrophies)
        .where(
          and(
            eq(psnUserTrophies.userId, userId),
            eq(psnUserTrophies.earned, true),
          ),
        ),
    ]);

    const unifiedFor = (key: PlatformKey) =>
      unified.find((row) => row.platform === key)?.n ?? 0;

    return {
      steam: unifiedFor("steam"),
      xbox: unifiedFor("xbox"),
      playstation: unifiedFor("playstation") + (playstation?.n ?? 0),
    };
  }

  // ── Covers ────────────────────────────────────────────────────────────────

  async enrichGameCovers(userId: string): Promise<{
    enriched: number;
    alreadyEnriched: number;
    noMatch: number;
  }> {
    return withLock(
      `job:covers:${userId}`,
      async () => {
        // Steam supplies its own covers; Xbox and PSN don't, hence IGDB.
        const allRows = await this.db
          .select({ id: games.id, title: games.title, coverUrl: games.coverUrl })
          .from(userGames)
          .innerJoin(games, eq(games.id, userGames.gameId))
          .where(
            and(
              eq(userGames.userId, userId),
              isVisibleInLibrary,
              inArray(games.platform, ["xbox", "playstation"]),
            ),
          );

        const alreadyEnrichedRows = allRows.filter((g) =>
          g.coverUrl?.includes("images.igdb.com"),
        );
        const targetGames = allRows
          .filter((g) => !g.coverUrl?.includes("images.igdb.com"))
          .map((g) => ({ id: g.id, title: g.title }));

        console.debug(
          `[LibraryService] enrichGameCovers: games=${allRows.length}, ` +
            `already enriched=${alreadyEnrichedRows.length}, targeting=${targetGames.length}`,
        );

        let enriched = 0;
        let noMatch = 0;

        for (let i = 0; i < targetGames.length; i += IGDB_BATCH_SIZE) {
          const batch = targetGames.slice(i, i + IGDB_BATCH_SIZE);

          await Promise.allSettled(
            batch.map(async (game) => {
              const coverUrl = await this.igdbProvider.searchGameCover(
                game.title,
              );

              if (coverUrl) {
                await this.db
                  .update(games)
                  .set({ coverUrl })
                  .where(eq(games.id, game.id));
                enriched++;
              } else {
                noMatch++;
              }
            }),
          );

          if (i + IGDB_BATCH_SIZE < targetGames.length) {
            await new Promise((resolve) => setTimeout(resolve, IGDB_DELAY_MS));
          }
        }

        return {
          enriched,
          alreadyEnriched: alreadyEnrichedRows.length,
          noMatch,
        };
      },
      this.lock ? { client: this.lock } : {},
    );
  }

  // ── Achievements (cross-platform dispatch) ────────────────────────────────

  /**
   * The platform of a game IN THE USER'S LIBRARY, or null. A game that exists
   * in the catalog but isn't theirs is "not found" to them — it must not be
   * dispatched to a platform module, which would sync or read on their behalf.
   */
  private async getGamePlatform(
    userId: string,
    gameId: string,
  ): Promise<Game["platform"] | null> {
    const [row] = await this.db
      .select({ platform: games.platform })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .limit(1);

    return (row?.platform as Game["platform"] | undefined) ?? null;
  }

  /** The handler for a game in the user's library, or a 404 if it isn't in it. */
  private async platformFor(
    userId: string,
    gameId: string,
  ): Promise<PlatformAchievements> {
    const platform = await this.getGamePlatform(userId, gameId);
    if (!platform) throw new GameNotFoundError(gameId);

    const handler = this.platforms[platform as PlatformKey];
    if (!handler) {
      throw new Error(`Unsupported platform for achievements: ${platform}`);
    }
    return handler;
  }

  async getGameAchievements(
    userId: string,
    gameId: string,
    options: AchievementQuery = {},
  ): Promise<AchievementPage> {
    const handler = await this.platformFor(userId, gameId);
    return handler.getAchievements(userId, gameId, options);
  }

  async syncGameAchievements(
    userId: string,
    gameId: string,
  ): Promise<{ synced: number }> {
    const handler = await this.platformFor(userId, gameId);
    return handler.syncAchievements(userId, gameId);
  }
}
