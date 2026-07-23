import { eq, desc, and, asc } from "drizzle-orm";
import {
  users,
  steamAccounts,
  steamGames,
  games,
  userGames,
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
import { deleteGameAndRelations } from "../../lib/game-deletion.utils";

// Thrown when a (userId, gameId) pair doesn't resolve to a Steam game this
// user owns — covers "not a Steam title", "user doesn't own it", and "no
// linked Steam account" as one case, since all three mean the same thing
// to a caller: there's nothing here for this user to sync or read.
export class SteamGameNotFoundError extends Error {
  constructor(
    public readonly gameId: string,
    public readonly userId: string,
  ) {
    super(
      `No Steam game found for game ${gameId} and user ${userId} — the game may not be a Steam title, the user may not own it, or their Steam account isn't linked`,
    );
    this.name = "SteamGameNotFoundError";
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
  steamAppId: string;
};

export class SteamService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: SteamProvider,
  ) {}

  // Shared between getUserGames/getUserGame so the two can't drift on how
  // a row gets mapped to the public Game shape.
  private mapRowToGame(row: GameRow): Game {
    return {
      id: row.id,
      externalId: row.steamAppId,
      title: row.title,
      platform: (row.platform ?? "steam") as Game["platform"],
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
        // This user's own added-at, not "whenever anyone first synced this
        // title" — see note below on why this moved off games.createdAt.
        addedAt: userGames.createdAt,
        updatedAt: userGames.updatedAt,
        steamAppId: steamGames.steamAppId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(steamGames, eq(steamGames.gameId, games.id))
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
        steamAppId: steamGames.steamAppId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(steamGames, eq(steamGames.gameId, games.id))
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .limit(1);

    if (!row) return null;

    return this.mapRowToGame(row);
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
          set: { lastSync: new Date() },
        });

      return steamData;
    });
  }

  async syncUserGames(localUserId: string, steamId: string) {
    const steamGamesList = await this.provider.getOwnedGames(steamId);
    if (!steamGamesList.length) return [];

    return await this.db.transaction(async (tx) => {
      // 1. Upsert the shared catalog — title/platform/artwork only. This
      //    table has no per-user columns; every owner of this title on
      //    this platform shares the one row.
      const catalogRows = await tx
        .insert(games)
        .values(
          steamGamesList.map((g) => ({
            title: g.name,
            platform: "steam" as const,
            iconUrl: g.iconUrl,
            coverUrl: g.coverUrl,
            bannerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${g.steamAppId}/library_hero.jpg`,
          })),
        )
        .onConflictDoUpdate({
          target: [games.title, games.platform],
          set: {
            iconUrl: sql`excluded.icon_url`,
            coverUrl: sql`excluded.cover_url`,
            bannerUrl: sql`excluded.banner_url`,
          },
        })
        .returning();

      // Maps each Steam title to its catalog row id. Known limitation: this
      // can only disambiguate by title, so if this user owns two different
      // Steam appIds that happen to share an exact title, the second will
      // shadow the first here. Pre-existing consequence of keying the
      // shared catalog on (title, platform) rather than an external id —
      // flagging it rather than quietly leaving it; a real fix means
      // resolving catalog rows via steamGames.steamAppId first and only
      // falling back to title matching for genuinely new titles.
      const titleToGameId = new Map(
        catalogRows.map((row) => [row.title, row.id]),
      );

      // 2. Map each catalog row to its Steam appId (idempotent — existing
      //    mappings are left untouched).
      const steamMappingValues = steamGamesList
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          return { gameId, steamAppId: g.steamAppId };
        })
        .filter((v): v is { gameId: string; steamAppId: string } => v !== null);

      if (steamMappingValues.length > 0) {
        await tx
          .insert(steamGames)
          .values(steamMappingValues)
          .onConflictDoNothing();
      }

      // 3. Upsert this user's ownership + personal state. This is the part
      //    that's genuinely per-user, which is exactly why it belongs on
      //    userGames rather than on the shared games row — writing it to
      //    games would mean the last user to sync overwrites every other
      //    owner's playtime and status on the same row.
      const userGameValues = steamGamesList
        .map((g) => {
          const gameId = titleToGameId.get(g.name);
          if (!gameId) return null;
          return {
            userId: localUserId,
            gameId,
            playTime: g.playtimeMinutes,
            lastPlayedAt: g.lastPlayedAt,
            status: deriveGameStatus({
              completionPercentage: 0,
              hasAchievements: true, // corrected below after achievement sync
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
            status: sql`excluded.status`,
          },
        })
        .returning();

      await tx
        .update(steamAccounts)
        .set({ lastSync: new Date() })
        .where(eq(steamAccounts.steamId, steamId));

      return upsertedUserGames;
    });
  }

  async syncAllGameAchievements(localUserId: string, gameIds: string[]) {
    const BATCH_SIZE = 5;
    const DELAY_MS = 200;

    for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
      const batch = gameIds.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((gameId) =>
          this.syncGameAchievements(localUserId, gameId).catch((err) => {
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
    // This is the actual ownership check: it only resolves when there's a
    // userGames row tying this exact user to this exact game, in addition
    // to the Steam mapping and a linked account. The old version joined
    // steamAccounts by userId alone with no tie back to the game, which
    // meant it resolved for *any* authenticated user asking about *any*
    // game in the shared catalog.
    const [row] = await this.db
      .select({
        steamAppId: steamGames.steamAppId,
        steamId: steamAccounts.steamId,
      })
      .from(userGames)
      .innerJoin(steamGames, eq(steamGames.gameId, userGames.gameId))
      .innerJoin(steamAccounts, eq(steamAccounts.userId, userGames.userId))
      .where(
        and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
      )
      .limit(1);

    if (!row) {
      throw new SteamGameNotFoundError(gameId, localUserId);
    }

    const [playerAchievements, schemaMap] = await Promise.all([
      this.provider.getPlayerAchievements(row.steamId, row.steamAppId),
      this.provider.getGameSchema(row.steamAppId),
    ]);

    if (schemaMap.size === 0) {
      console.debug(
        `[SteamService] Game ${gameId} (appId ${row.steamAppId}) has no achievement definitions — removing from library`,
      );
      // NOTE: this removes the game from the shared catalog for every
      // owner, not just localUserId — pre-existing behavior, unchanged by
      // this pass. Worth confirming deleteGameAndRelations either deletes
      // the games row directly (letting the new userGames FK cascade
      // clean up every owner's row automatically) or is updated to also
      // clean up userGames explicitly — haven't seen that file yet.
      await deleteGameAndRelations(this.db, gameId);
      return [];
    }

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

      // Read this user's current playtime/lastPlayedAt from userGames (not
      // the shared games row) so deriveGameStatus has this user's own
      // context, not whichever owner synced most recently.
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

      // Write to userGames, not games — this is this user's completion
      // state, not the shared catalog row's.
      await tx
        .update(userGames)
        .set({ completionPercentage, status: refinedStatus })
        .where(
          and(eq(userGames.userId, localUserId), eq(userGames.gameId, gameId)),
        );

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

    // Was a correlated subquery repeated three times below; replaced with
    // a real join to steamGames (already how the `rows` query does it),
    // scoped directly by gameId instead of resolving steamAppId per row.
    const [existing] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievementId),
      )
      .innerJoin(steamGames, eq(steamGames.steamAppId, achievements.steamAppId))
      .where(
        and(eq(userAchievements.userId, userId), eq(steamGames.gameId, gameId)),
      );

    if (!existing || existing.count === 0) {
      // If this user doesn't actually own gameId, this throws
      // SteamGameNotFoundError and propagates straight out of this method —
      // achievements for a game you don't own are never returned.
      await this.syncGameAchievements(userId, gameId);
    }

    const filterConditions = and(
      eq(userAchievements.userId, userId),
      eq(steamGames.gameId, gameId),
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
        .innerJoin(
          steamGames,
          eq(steamGames.steamAppId, achievements.steamAppId),
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
