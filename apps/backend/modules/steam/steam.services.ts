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

/**
 * Custom error thrown when a Steam game cannot be found for a given user.
 *
 * Covers three indistinguishable cases from the caller's perspective: the
 * title is not a Steam game, the user does not own it, or no Steam account
 * is linked.
 *
 * @example
 * ```ts
 * throw new SteamGameNotFoundError("game-uuid", "user-uuid");
 * // Error: No Steam game found for game game-uuid and user user-uuid — ...
 * ```
 */
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

/**
 * Service layer for all Steam integrations.
 *
 * Handles Steam account linking, game library synchronisation, achievement
 * fetching, and achievement-style read queries consumed by the frontend.
 *
 * @remarks
 * All methods that touch the Steam API operate against a linked Steam
 * account identified by `steamId`. The service never calls the Steam API
 * without first resolving the user's `steamId` from the database.
 *
 * @example
 * ```ts
 * const steam = new SteamService(db, steamProvider);
 * const games = await steam.getUserGames("user-uuid");
 * ```
 */
export class SteamService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: SteamProvider,
  ) {}

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

  /**
   * Returns every Steam game in the user's library, ordered by play time
   * (highest first).
   *
   * @param userId - Internal user identifier whose library to fetch.
   * @returns Array of {@link Game} objects. An empty array is returned when
   *   the user has no Steam titles.
   *
   * @example
   * ```ts
   * const games = await steamService.getUserGames("abc-123");
   * console.log(games.length); // 87
   * ```
   */
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
        steamAppId: steamGames.steamAppId,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .innerJoin(steamGames, eq(steamGames.gameId, games.id))
      .where(eq(userGames.userId, userId))
      .orderBy(desc(userGames.playTime));

    return rows.map((row) => this.mapRowToGame(row));
  }

  /**
   * Returns a single Steam game from the user's library, or `null` if it
   * does not exist.
   *
   * @param userId - Internal user identifier.
   * @param gameId - UUID of the game to retrieve.
   * @returns The matching {@link Game}, or `null` when no row is found.
   *
   * @example
   * ```ts
   * const game = await steamService.getUserGame("abc-123", "game-uuid");
   * if (game) {
   *   console.log(game.title);
   * }
   * ```
   */
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

  /**
   * Fetches the Steam player summary and upserts both the local user
   * record and the linked Steam account inside a single transaction.
   *
   * @param localUserId - Internal user identifier to link the Steam account
   *   to.
   * @param steamId - The 64-bit Steam ID to look up.
   * @returns The Steam profile data that was persisted.
   * @throws {Error} If no Steam profile is found for the given `steamId`.
   *
   * @example
   * ```ts
   * const profile = await steamService.syncUserProfile(
   *   "user-uuid",
   *   "76561198012345678",
   * );
   * console.log(profile.displayName);
   * ```
   */
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

  /**
   * Fetches the user's full owned-games list from Steam and upserts the
   * shared game catalog, Steam app-ID mappings, and per-user ownership
   * rows inside a single transaction.
   *
   * @remarks
   * The shared `games` table is keyed on `(title, platform)`, so two
   * different Steam app-ids sharing an exact title will shadow each other.
   * Per-user state (play time, last played, status) is written exclusively
   * to `userGames` to avoid cross-user overwrites.
   *
   * @param localUserId - Internal user identifier whose library to sync.
   * @param steamId - The 64-bit Steam ID to fetch games for.
   * @returns Array of upserted {@link userGames} rows. An empty array is
   *   returned when the Steam API returns no games.
   *
   * @example
   * ```ts
   * const synced = await steamService.syncUserGames(
   *   "abc-123",
   *   "76561198012345678",
   * );
   * console.log(`Synced ${synced.length} games`);
   * ```
   */
  async syncUserGames(localUserId: string, steamId: string) {
    const steamGamesList = await this.provider.getOwnedGames(steamId);
    if (!steamGamesList.length) return [];

    return await this.db.transaction(async (tx) => {
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

      const titleToGameId = new Map(
        catalogRows.map((row) => [row.title, row.id]),
      );

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

  /**
   * Syncs achievements for multiple games in batches, respecting Steam API
   * rate limits.
   *
   * Each batch contains up to `5` games and is followed by a `200`
   * millisecond pause. Individual failures are logged and skipped — the
   * remaining games continue syncing.
   *
   * @param localUserId - Internal user identifier.
   * @param gameIds - Array of game UUIDs to sync achievements for.
   *
   * @example
   * ```ts
   * await steamService.syncAllGameAchievements("user-uuid", [
   *   "game-1",
   *   "game-2",
   *   "game-3",
   * ]);
   * ```
   */
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

  /**
   * Syncs the full achievement list for a single game, scoped to the
   * requesting user's ownership.
   *
   * @remarks
   * The query joins through `userGames` to verify ownership before calling
   * the Steam API. If the user does not own the game, a
   * {@link SteamGameNotFoundError} is thrown.
   *
   * When the Steam API reports zero achievement definitions for a game the
   * game is removed from the shared catalog via
   * {@link deleteGameAndRelations}.
   *
   * After syncing, the user's `completionPercentage` and derived `status`
   * are recalculated and persisted.
   *
   * @param localUserId - Internal user identifier.
   * @param gameId - UUID of the game to sync.
   * @returns Array of upserted achievement rows. An empty array is returned
   *   when the Steam API has no data or the game has no definitions.
   * @throws {SteamGameNotFoundError} When the user does not own the given
   *   game or the game has no Steam mapping.
   *
   * @example
   * ```ts
   * const achievements = await steamService.syncGameAchievements(
   *   "user-uuid",
   *   "game-uuid",
   * );
   * console.log(`Synced ${achievements.length} achievements`);
   * ```
   */
  async syncGameAchievements(localUserId: string, gameId: string) {
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

  /**
   * Returns paginated, filterable, sortable achievements for a single game.
   *
   * If the user has no cached achievements for this game, a lazy sync is
   * triggered via {@link SteamService.syncGameAchievements} before the
   * query executes.
   *
   * @param userId - Internal user identifier.
   * @param gameId - UUID of the game whose achievements to retrieve.
   * @param options - Query controls.
   * @param options.filter - `'all'` | `'unlocked'` | `'locked'`. Defaults
   *   to `'all'`.
   * @param options.sort - `'rarity'` | `'unlock-date'` | `'name'`. Defaults
   *   to `'rarity'`.
   * @param options.limit - Maximum rows returned. Defaults to `50`.
   * @param options.offset - Row offset for pagination. Defaults to `0`.
   * @returns An object containing the `data` array of {@link Achievement}
   *   objects, the `total` count, and the `unlocked` count.
   * @throws {SteamGameNotFoundError} When the user does not own the game
   *   and the lazy-sync path fails.
   *
   * @example
   * ```ts
   * const { data, total, unlocked } = await steamService.getGameAchievements(
   *   "user-uuid",
   *   "game-uuid",
   *   { filter: "unlocked", sort: "rarity", limit: 10 },
   * );
   * console.log(`${unlocked}/${total} unlocked`);
   * ```
   */
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
      .innerJoin(steamGames, eq(steamGames.steamAppId, achievements.steamAppId))
      .where(
        and(eq(userAchievements.userId, userId), eq(steamGames.gameId, gameId)),
      );

    if (!existing || existing.count === 0) {
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
