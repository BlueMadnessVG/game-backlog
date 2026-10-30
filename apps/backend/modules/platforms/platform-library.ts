import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type {
  Achievement,
  AchievementFilter,
  AchievementSort,
} from "@repo/shared";

import {
  achievements,
  games,
  userAchievements,
  userGames,
} from "../../db/schema";
import type { DbClient } from "../../db";
import { withLock, type AdvisoryLockClient } from "../../lib/locks";
import { deriveGameStatus } from "../../lib/game.utils";
import {
  setHasAchievements,
  withoutKnownNoAchievementGames,
} from "../../lib/game-catalog";
import { GameNotFoundError } from "./errors";
import type {
  NormalizedAchievement,
  OwnedGame,
  PlatformAdapter,
  PlatformKey,
} from "./platform-adapter";

export type AchievementQuery = {
  filter?: AchievementFilter;
  sort?: AchievementSort;
  limit?: number;
  offset?: number;
};

export type AchievementPage = {
  data: Achievement[];
  total: number;
  unlocked: number;
};

/** What `LibraryService` needs from a platform to serve achievements. */
export interface PlatformAchievements {
  getAchievements(
    userId: string,
    gameId: string,
    query?: AchievementQuery,
  ): Promise<AchievementPage>;
  syncAchievements(userId: string, gameId: string): Promise<{ synced: number }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything that is the same for Steam, Xbox and PlayStation: linking an
 * account, syncing the library into the shared catalog and the user's own
 * rows, syncing achievements (with the rules about what an empty or failed
 * answer means), and reading them back.
 *
 * @remarks
 * A {@link PlatformAdapter} supplies only what differs: which API to call and
 * how to normalize what comes back. The rules that keep users apart and the
 * catalog intact live here once:
 *  - A user's library is their `user_games` rows; per-user values (play time,
 *    completion, status) are written only there.
 *  - The catalog (`games`, `achievements`) is shared. What one user's sync
 *    learns about a GAME is recorded on the catalog row (`hasAchievements`),
 *    never by deleting it.
 *  - A failed lookup is not an empty one: `error` changes nothing.
 */
export class PlatformLibrary<Account = unknown, LinkBody = unknown>
  implements PlatformAchievements
{
  constructor(
    private readonly db: DbClient,
    readonly adapter: PlatformAdapter<Account, LinkBody>,
    private readonly lock?: AdvisoryLockClient,
  ) {}

  get platform(): PlatformKey {
    return this.adapter.platform;
  }

  private lockOptions() {
    return this.lock ? { client: this.lock } : {};
  }

  // ── Linking and library sync ───────────────────────────────────────────────

  /**
   * Links the user's account and syncs their library, as one locked step so
   * two taps on "sync" can't interleave.
   *
   * @returns The profile to show, and the ids of the user's games (catalog
   *   ids, which is what {@link PlatformLibrary.syncAllAchievements} takes).
   */
  async link(
    userId: string,
    body: LinkBody,
  ): Promise<{ profile: object; gameIds: string[] }> {
    return withLock(
      `sync:${this.platform}:${userId}`,
      async () => {
        const profile = await this.adapter.link(this.db, userId, body);
        const synced = await this.syncGames(userId);
        return { profile, gameIds: synced.map((g) => g.gameId) };
      },
      this.lockOptions(),
    );
  }

  /**
   * Fetches the user's owned games and upserts them into the shared catalog
   * (keyed by platform + external id) and into the user's own library.
   *
   * @returns The user's games from this sync, as catalog ids. Empty when the
   *   platform reports none.
   */
  async syncGames(userId: string): Promise<{ gameId: string }[]> {
    const account = await this.adapter.loadAccount(this.db, userId);
    if (!account) {
      throw new Error(
        `No ${this.platform} account linked for user ${userId} — sync required`,
      );
    }

    const owned = await this.adapter.fetchOwnedGames(account);
    if (!owned.length) return [];

    // TRANSITIONAL (removed once the catalog drops its (title, platform)
    // unique index): that index still rejects two catalog rows with one title,
    // and an upsert that hits a key twice fails the whole statement.
    const toSync = collapseByTitle(owned);

    return this.db.transaction(async (tx) => {
      const catalogRows = await tx
        .insert(games)
        .values(
          toSync.map((g) => ({
            title: g.title,
            platform: this.platform,
            externalId: g.externalId,
            iconUrl: g.iconUrl,
            coverUrl: g.coverUrl,
            bannerUrl: g.bannerUrl,
            metadata: g.metadata ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: [games.platform, games.externalId],
          set: {
            title: sql`excluded.title`,
            // Never clobber a cover that IGDB filled in with "nothing".
            iconUrl: sql`coalesce(excluded.icon_url, ${games.iconUrl})`,
            coverUrl: sql`coalesce(${games.coverUrl}, excluded.cover_url)`,
            bannerUrl: sql`coalesce(excluded.banner_url, ${games.bannerUrl})`,
            metadata: sql`excluded.metadata`,
          },
        })
        .returning({ id: games.id, externalId: games.externalId });

      const gameIdByExternalId = new Map(
        catalogRows.map((row) => [row.externalId, row.id]),
      );

      const userRows = toSync.flatMap((g) => {
        const gameId = gameIdByExternalId.get(g.externalId);
        if (!gameId) return [];
        return [
          {
            userId,
            gameId,
            playTime: g.playTimeMinutes ?? 0,
            lastPlayedAt: g.lastPlayedAt,
            completionPercentage: g.completionPercentage ?? 0,
            status: deriveGameStatus({
              completionPercentage: g.completionPercentage ?? 0,
              hasAchievements: true,
              playTimeMinutes: g.playTimeMinutes ?? 0,
              lastPlayedAt: g.lastPlayedAt,
              platinumEarned: g.platinumEarned,
            }),
          },
        ];
      });

      // Only overwrite what this platform actually reports: a platform with
      // no play time must not reset it to 0, and Steam's completion comes
      // from its achievements, not from the library list.
      const set: Record<string, SQL> = {
        lastPlayedAt: sql`excluded.last_played_at`,
        status: sql`excluded.status`,
      };
      if (toSync.some((g) => g.playTimeMinutes !== null)) {
        set.playTime = sql`excluded.play_time`;
      }
      if (toSync.some((g) => g.completionPercentage !== null)) {
        set.completionPercentage = sql`excluded.completion_percentage`;
      }

      return tx
        .insert(userGames)
        .values(userRows)
        .onConflictDoUpdate({
          target: [userGames.userId, userGames.gameId],
          set,
        })
        .returning({ gameId: userGames.gameId });
    });
  }

  // ── Achievement sync ───────────────────────────────────────────────────────

  /**
   * Syncs achievements for many games in rate-limited batches. Games already
   * known to have none are skipped without calling the platform. A failure on
   * one game is logged and the rest continue.
   */
  async syncAllAchievements(userId: string, gameIds: string[]): Promise<void> {
    return withLock(
      `job:ach:${this.platform}:${userId}`,
      async () => {
        const toSync = await withoutKnownNoAchievementGames(this.db, gameIds);
        const { size, delayMs } = this.adapter.batch;

        for (let i = 0; i < toSync.length; i += size) {
          const batch = toSync.slice(i, i + size);

          await Promise.allSettled(
            batch.map((gameId) =>
              this.syncAchievements(userId, gameId).catch((err) => {
                console.warn(
                  `[PlatformLibrary:${this.platform}] Achievement sync skipped for game ${gameId}:`,
                  err,
                );
              }),
            ),
          );

          if (i + size < toSync.length) await sleep(delayMs);
        }
      },
      this.lockOptions(),
    );
  }

  /**
   * Syncs one game's achievements for one user, then recomputes that user's
   * completion and status.
   *
   * @remarks
   * What the platform answered decides what is written:
   *  - `error`: nothing. We don't know anything.
   *  - `empty`: the shared catalog row is flagged `hasAchievements = false`
   *    (hiding it from library reads). It is never deleted: other users own it.
   *  - `ok`: the flag is set to `true` and the definitions and this user's
   *    unlock state are upserted, all in one transaction.
   *
   * @throws {GameNotFoundError} When the game isn't in the user's library for
   *   this platform, or they have no account linked.
   */
  async syncAchievements(
    userId: string,
    gameId: string,
  ): Promise<{ synced: number }> {
    const game = await this.requireOwnedGame(userId, gameId);
    const account = await this.adapter.loadAccount(this.db, userId);
    if (!account) throw new GameNotFoundError(gameId);

    const outcome = await this.adapter.fetchAchievements(account, {
      externalId: game.externalId,
      metadata: game.metadata,
    });

    if (outcome.status === "error") return { synced: 0 };

    // An `ok` with nothing in it is an empty answer too (and an upsert of zero
    // rows would fail), so it is handled the same way.
    if (
      outcome.status === "empty" ||
      (outcome.status === "ok" && outcome.achievements.length === 0)
    ) {
      console.debug(
        `[PlatformLibrary:${this.platform}] Game ${gameId} (${game.externalId}) has no achievements — hiding from library`,
      );
      await setHasAchievements(this.db, gameId, false);
      return { synced: 0 };
    }

    // A platform key is unique within a game; if one ever repeats, an upsert
    // would hit the same row twice and fail, so keep the last.
    const list = [
      ...new Map(outcome.achievements.map((a) => [a.externalKey, a])).values(),
    ];

    return this.db.transaction(async (tx) => {
      await setHasAchievements(tx, gameId, true);

      const definitions = await tx
        .insert(achievements)
        .values(
          list.map((a) => ({
            gameId,
            externalKey: a.externalKey,
            name: a.name,
            description: a.description,
            hidden: a.hidden,
            iconUrl: a.iconUrl,
            iconGrayUrl: a.iconGrayUrl,
            globalPercentage: a.globalPercentage,
            points: a.points,
            tier: a.tier,
          })),
        )
        .onConflictDoUpdate({
          target: [achievements.gameId, achievements.externalKey],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            hidden: sql`excluded.hidden`,
            iconUrl: sql`excluded.icon_url`,
            iconGrayUrl: sql`excluded.icon_gray_url`,
            globalPercentage: sql`excluded.global_percentage`,
            points: sql`excluded.points`,
            tier: sql`excluded.tier`,
          },
        })
        .returning({ id: achievements.id, externalKey: achievements.externalKey });

      const achievementIdByKey = new Map(
        definitions.map((d) => [d.externalKey, d.id]),
      );

      await tx
        .insert(userAchievements)
        .values(
          list.flatMap((a) => {
            const achievementId = achievementIdByKey.get(a.externalKey);
            return achievementId
              ? [
                  {
                    userId,
                    achievementId,
                    achieved: a.achieved,
                    unlockedAt: a.unlockedAt,
                  },
                ]
              : [];
          }),
        )
        .onConflictDoUpdate({
          target: [userAchievements.userId, userAchievements.achievementId],
          set: {
            achieved: sql`excluded.achieved`,
            unlockedAt: sql`excluded.unlocked_at`,
          },
        });

      const achievedCount = list.filter((a) => a.achieved).length;
      const completionPercentage =
        list.length > 0 ? (achievedCount / list.length) * 100 : 0;
      const platinumEarned = list.some(
        (a) => a.tier === "platinum" && a.achieved,
      );

      const [progress] = await tx
        .select({
          playTime: userGames.playTime,
          lastPlayedAt: userGames.lastPlayedAt,
        })
        .from(userGames)
        .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
        .limit(1);

      await tx
        .update(userGames)
        .set({
          completionPercentage,
          status: deriveGameStatus({
            completionPercentage,
            hasAchievements: list.length > 0,
            playTimeMinutes: progress?.playTime ?? 0,
            lastPlayedAt: progress?.lastPlayedAt ?? null,
            platinumEarned,
          }),
        })
        .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)));

      return { synced: definitions.length };
    });
  }

  // ── Achievement reads ──────────────────────────────────────────────────────

  /**
   * One page of the user's achievements for a game, filtered and sorted. If
   * nothing is cached for the user yet, it is synced first.
   *
   * @throws {GameNotFoundError} When the game isn't in the user's library for
   *   this platform.
   */
  async getAchievements(
    userId: string,
    gameId: string,
    query: AchievementQuery = {},
  ): Promise<AchievementPage> {
    const { filter = "all", sort = "rarity", limit = 50, offset = 0 } = query;

    await this.requireOwnedGame(userId, gameId);

    const where = and(
      eq(userAchievements.userId, userId),
      eq(achievements.gameId, gameId),
    );

    const [cached] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievementId),
      )
      .where(where);

    if (!cached || cached.n === 0) {
      await withLock(
        `ach:${this.platform}:${userId}:${gameId}`,
        () => this.syncAchievements(userId, gameId),
        this.lockOptions(),
      );
    }

    const filtered = and(
      where,
      filter === "unlocked" ? eq(userAchievements.achieved, true) : undefined,
      filter === "locked" ? eq(userAchievements.achieved, false) : undefined,
    );

    const order =
      sort === "rarity"
        ? desc(achievements.globalPercentage)
        : sort === "unlock-date"
          ? desc(userAchievements.unlockedAt)
          : asc(achievements.name);

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: achievements.id,
          externalKey: achievements.externalKey,
          gameId: achievements.gameId,
          name: achievements.name,
          description: achievements.description,
          hidden: achievements.hidden,
          iconUrl: achievements.iconUrl,
          iconGrayUrl: achievements.iconGrayUrl,
          globalPercentage: achievements.globalPercentage,
          achieved: userAchievements.achieved,
          unlockedAt: userAchievements.unlockedAt,
          addedAt: achievements.createdAt,
          updatedAt: achievements.updatedAt,
        })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(achievements.id, userAchievements.achievementId),
        )
        .where(filtered)
        .orderBy(order, asc(achievements.id))
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          unlocked: sql<number>`(count(*) filter (where ${userAchievements.achieved}))::int`,
        })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(achievements.id, userAchievements.achievementId),
        )
        .where(filtered),
    ]);

    const { total, unlocked } = totals[0] ?? { total: 0, unlocked: 0 };

    return {
      total,
      unlocked,
      data: rows.map((row) => ({
        id: row.id,
        externalId: row.externalKey,
        gameId: row.gameId,
        name: row.name,
        description: row.description,
        hidden: row.hidden,
        iconUrl: row.iconUrl,
        iconGrayUrl: row.iconGrayUrl,
        achieved: row.achieved,
        unlockedAt: row.unlockedAt?.toISOString() ?? null,
        globalPercentage: row.globalPercentage,
        addedAt: row.addedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  // ── Shared ─────────────────────────────────────────────────────────────────

  /** The game, if it's in this user's library on this platform. */
  private async requireOwnedGame(userId: string, gameId: string) {
    const [row] = await this.db
      .select({
        externalId: games.externalId,
        metadata: games.metadata,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .where(
        and(
          eq(userGames.userId, userId),
          eq(userGames.gameId, gameId),
          eq(games.platform, this.platform),
        ),
      )
      .limit(1);

    if (!row || !row.externalId) throw new GameNotFoundError(gameId);
    return { externalId: row.externalId, metadata: row.metadata };
  }
}

/** Keeps one entry per title: the one with the most play time / progress. */
function collapseByTitle(owned: OwnedGame[]): OwnedGame[] {
  const rank = (g: OwnedGame) =>
    (g.playTimeMinutes ?? 0) * 1_000_000 + (g.completionPercentage ?? 0);
  const recency = (g: OwnedGame) => g.lastPlayedAt?.getTime() ?? 0;

  const byTitle = new Map<string, OwnedGame>();
  for (const game of owned) {
    const kept = byTitle.get(game.title);
    if (
      !kept ||
      rank(game) > rank(kept) ||
      (rank(game) === rank(kept) && recency(game) > recency(kept))
    ) {
      byTitle.set(game.title, game);
    }
  }
  return [...byTitle.values()];
}

export type { NormalizedAchievement };
