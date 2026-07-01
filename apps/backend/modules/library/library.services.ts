import { eq, and, sql } from "drizzle-orm";
import {
  games,
  userAchievements,
  achievements,
  steamGames,
  steamAccounts,
  xboxGames,
  xboxAccounts,
  xboxUserAchievements,
  xboxAchievements,
  psnGames,
  psnAccounts,
  psnUserTrophies,
} from "../../db/schema";
import type { DbClient } from "../../db";
import type { Game, PlatformStats, Stats } from "@repo/shared";

export class LibraryService {
  constructor(private readonly db: DbClient) {}

  // ── Combined games list ──────────────────────────────────────────────────

  async getUserGames(userId: string): Promise<Game[]> {
    const [steamRows, xboxRows, psnRows] = await Promise.all([
      this.getSteamGames(userId),
      this.getXboxGames(userId),
      this.getPsnGames(userId),
    ]);

    const combined = [...steamRows, ...xboxRows, ...psnRows];

    combined.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return combined;
  }

  private async getSteamGames(userId: string): Promise<Game[]> {
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
        externalId: steamGames.steamAppId,
      })
      .from(games)
      .innerJoin(steamGames, eq(games.id, steamGames.gameId))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, userId))
      .where(eq(steamAccounts.userId, userId));

    return rows.map((row) => this.mapRowToGame(row, "steam"));
  }

  private async getXboxGames(userId: string): Promise<Game[]> {
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
        externalId: xboxGames.titleId,
      })
      .from(games)
      .innerJoin(xboxGames, eq(games.id, xboxGames.gameId))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userId))
      .where(eq(xboxAccounts.userId, userId));

    return rows.map((row) => this.mapRowToGame(row, "xbox"));
  }

  private async getPsnGames(userId: string): Promise<Game[]> {
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
        externalId: psnGames.npCommunicationId,
      })
      .from(games)
      .innerJoin(psnGames, eq(games.id, psnGames.gameId))
      .innerJoin(psnAccounts, eq(psnAccounts.userId, userId))
      .where(eq(psnAccounts.userId, userId));

    return rows.map((row) => this.mapRowToGame(row, "playstation"));
  }

  private mapRowToGame(
    row: {
      id: string;
      title: string;
      platform: string | null;
      status: string | null;
      iconUrl: string | null;
      coverUrl: string | null;
      bannerUrl: string | null;
      playTime: number | null;
      completionPercentage: number | null;
      lastPlayedAt: Date | null;
      addedAt: Date;
      updatedAt: Date;
      externalId: string;
    },
    fallbackPlatform: "steam" | "xbox" | "playstation",
  ): Game {
    return {
      id: row.id,
      externalId: row.externalId,
      title: row.title,
      platform: (row.platform ?? fallbackPlatform) as Game["platform"],
      status: (row.status ?? "backlog") as Game["status"],
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

  // ── Stats (unchanged) ─────────────────────────────────────────────────────

  async getStats(userId: string): Promise<Stats> {
    const [steam, xbox, playstation] = await Promise.all([
      this.getSteamStats(userId),
      this.getXboxStats(userId),
      this.getPlaystationStats(userId),
    ]);

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

  private async getSteamStats(userId: string): Promise<PlatformStats> {
    const [gameStats] = await this.db
      .select({
        games: sql<number>`count(*)::int`,
        completionPercentage: sql<number>`
          round(coalesce(avg(${games.completionPercentage}), 0)::numeric, 1)::float
        `,
        completedGames: sql<number>`
          sum(case when ${games.status} = 'completed' then 1 else 0 end)::int
        `,
      })
      .from(games)
      .innerJoin(steamGames, eq(steamGames.gameId, games.id))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, userId))
      .where(eq(steamAccounts.userId, userId));

    const [achStats] = await this.db
      .select({
        achievements: sql<number>`count(*)::int`,
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievementId),
      )
      .innerJoin(steamGames, eq(steamGames.steamAppId, achievements.steamAppId))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, userId))
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achieved, true),
        ),
      );

    return {
      games: gameStats?.games ?? 0,
      completionPercentage: gameStats?.completionPercentage ?? 0,
      completedGames: gameStats?.completedGames ?? 0,
      achievements: achStats?.achievements ?? 0,
    };
  }

  private async getXboxStats(userId: string): Promise<PlatformStats> {
    const [gameStats] = await this.db
      .select({
        games: sql<number>`count(*)::int`,
        completionPercentage: sql<number>`
          round(coalesce(avg(${games.completionPercentage}), 0)::numeric, 1)::float
        `,
        completedGames: sql<number>`
          sum(case when ${games.status} = 'completed' then 1 else 0 end)::int
        `,
      })
      .from(games)
      .innerJoin(xboxGames, eq(xboxGames.gameId, games.id))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userId))
      .where(eq(xboxAccounts.userId, userId));

    const [achStats] = await this.db
      .select({
        achievements: sql<number>`count(*)::int`,
      })
      .from(xboxUserAchievements)
      .innerJoin(
        xboxAchievements,
        eq(xboxAchievements.id, xboxUserAchievements.achievementId),
      )
      .innerJoin(xboxGames, eq(xboxGames.titleId, xboxAchievements.titleId))
      .innerJoin(xboxAccounts, eq(xboxAccounts.userId, userId))
      .where(
        and(
          eq(xboxUserAchievements.userId, userId),
          eq(xboxUserAchievements.achieved, true),
        ),
      );

    return {
      games: gameStats?.games ?? 0,
      completionPercentage: gameStats?.completionPercentage ?? 0,
      completedGames: gameStats?.completedGames ?? 0,
      achievements: achStats?.achievements ?? 0,
    };
  }

  private async getPlaystationStats(userId: string): Promise<PlatformStats> {
    const [gameStats] = await this.db
      .select({
        games: sql<number>`count(*)::int`,
        completionPercentage: sql<number>`
          round(coalesce(avg(${games.completionPercentage}), 0)::numeric, 1)::float
        `,
        completedGames: sql<number>`
          sum(case when ${games.status} = 'completed' then 1 else 0 end)::int
        `,
      })
      .from(games)
      .innerJoin(psnGames, eq(psnGames.gameId, games.id))
      .innerJoin(psnAccounts, eq(psnAccounts.userId, userId))
      .where(eq(psnAccounts.userId, userId));

    const [achStats] = await this.db
      .select({
        achievements: sql<number>`count(*)::int`,
      })
      .from(psnUserTrophies)
      .innerJoin(
        psnGames,
        eq(
          psnGames.npCommunicationId,
          sql`(
          select np_communication_id from psn_trophies
          where psn_trophies.id = ${psnUserTrophies.trophyId}
          limit 1
        )`,
        ),
      )
      .innerJoin(psnAccounts, eq(psnAccounts.userId, userId))
      .where(
        and(
          eq(psnUserTrophies.userId, userId),
          eq(psnUserTrophies.earned, true),
        ),
      );

    return {
      games: gameStats?.games ?? 0,
      completionPercentage: gameStats?.completionPercentage ?? 0,
      completedGames: gameStats?.completedGames ?? 0,
      achievements: achStats?.achievements ?? 0,
    };
  }
}
