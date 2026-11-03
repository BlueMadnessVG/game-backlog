import { and, eq } from "drizzle-orm";

import {
  achievements,
  games,
  psnAccounts,
  steamAccounts,
  userAchievements,
  userGames,
  users,
  xboxAccounts,
} from "../db/schema";
import type { DbClient } from "../db";
import { encrypt } from "../lib/Encryption.utils";

/**
 * Scenario builders for tests that run against a real database (see
 * test-db.ts). They write through the schema, so a test reads as
 * "user A owns this game" instead of as a pile of inserts.
 */

export type Platform = "steam" | "xbox" | "playstation";
type Status = "backlog" | "in-progress" | "completed" | "retired";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Creates a user with a linked account on every platform. */
export async function seedUser(db: DbClient, name: string): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ username: name, email: `${name}-${unique()}@example.com` })
    .returning({ id: users.id });
  const userId = user!.id;

  await db.insert(steamAccounts).values({ userId, steamId: `steam-${unique()}` });
  await db.insert(xboxAccounts).values({ userId, xuid: `xuid-${unique()}` });
  await db.insert(psnAccounts).values({
    userId,
    accountId: `psn-${unique()}`,
    // PsnAdapter decrypts tokens on read, so they must be real ciphertext.
    accessToken: encrypt("seed-access-token"),
    refreshToken: encrypt("seed-refresh-token"),
    accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
  });
  return userId;
}

/**
 * A game in the shared catalog plus its platform mapping row. `externalId`
 * is the Steam app id, Xbox title id or PSN npCommunicationId.
 */
export async function seedCatalogGame(
  db: DbClient,
  opts: { title: string; platform: Platform; externalId?: string },
): Promise<{ gameId: string; externalId: string }> {
  const externalId = opts.externalId ?? `ext-${unique()}`;
  const [game] = await db
    .insert(games)
    .values({
      title: opts.title,
      platform: opts.platform,
      // The platform's own id lives on the catalog row.
      externalId,
    })
    .returning({ id: games.id });
  return { gameId: game!.id, externalId };
}

/** Puts a catalog game in a user's library with that user's own progress. */
export async function seedOwnership(
  db: DbClient,
  userId: string,
  gameId: string,
  opts: {
    status?: Status;
    playTime?: number;
    completionPercentage?: number;
    lastPlayedAt?: Date | null;
    updatedAt?: Date;
  } = {},
): Promise<void> {
  await db.insert(userGames).values({
    userId,
    gameId,
    status: opts.status ?? "backlog",
    playTime: opts.playTime ?? 0,
    completionPercentage: opts.completionPercentage ?? 0,
    lastPlayedAt: opts.lastPlayedAt ?? null,
    ...(opts.updatedAt ? { updatedAt: opts.updatedAt } : {}),
  });
  // $onUpdate/defaultNow would otherwise override a requested timestamp.
  if (opts.updatedAt) {
    await db
      .update(userGames)
      .set({ updatedAt: opts.updatedAt })
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)));
  }
}

/** Convenience: catalog game + ownership in one call. */
export async function seedOwnedGame(
  db: DbClient,
  userId: string,
  opts: { title: string; platform: Platform; externalId?: string } & Parameters<
    typeof seedOwnership
  >[3],
): Promise<{ gameId: string; externalId: string }> {
  const { title, platform, externalId, ...progress } = opts;
  const game = await seedCatalogGame(db, { title, platform, externalId });
  await seedOwnership(db, userId, game.gameId, progress);
  return game;
}

/**
 * Gives a user `unlocked` earned and `locked` unearned achievements for a
 * game. Achievement definitions are shared between users (one row per game),
 * only the user_* rows are per-user — so two users can call this for the same
 * game and each gets their own unlock state.
 */
export async function seedAchievements(
  db: DbClient,
  opts: {
    userId: string;
    gameId: string;
    unlocked: number;
    locked?: number;
  },
): Promise<void> {
  const { userId, gameId } = opts;
  const total = opts.unlocked + (opts.locked ?? 0);

  for (let i = 0; i < total; i++) {
    const achieved = i < opts.unlocked;
    const apiName = `ACH_${i}`;

    await db
      .insert(achievements)
      .values({ gameId, externalKey: apiName, name: `Ach ${i}` })
      .onConflictDoNothing();
    const [def] = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(
        and(
          eq(achievements.gameId, gameId),
          eq(achievements.externalKey, apiName),
        ),
      );
    await db
      .insert(userAchievements)
      .values({ userId, achievementId: def!.id, achieved });
  }
}
