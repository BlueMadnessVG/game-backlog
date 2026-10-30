import { and, eq, inArray, sql } from "drizzle-orm";

import { games } from "../db/schema";
import type { DbClient } from "../db";

/**
 * Rules for the shared game catalog (`games` and its platform mapping rows).
 *
 * The catalog is shared by every user, so nothing a single user's sync learns
 * may delete from it: a user's library is their `user_games` rows, and the
 * catalog only records facts about the GAME itself.
 */

/** A `db` or a transaction `tx`. */
type Db = Pick<DbClient, "update" | "select">;

/**
 * Records whether the platform lists any achievements/trophies for a game.
 * `false` hides the game from library reads and stops the batch sync from
 * calling the platform for it; `true` brings it back. An explicit re-sync of
 * the game always re-checks, so a game that later gains achievements recovers.
 */
export async function setHasAchievements(
  db: Db,
  gameId: string,
  value: boolean,
): Promise<void> {
  await db
    .update(games)
    .set({ hasAchievements: value })
    .where(eq(games.id, gameId));
}

/**
 * SQL condition for library reads: hides games the platform says have no
 * achievements. `null` ("not checked yet") stays visible, so a freshly synced
 * library isn't empty until every game has been checked.
 */
export const isVisibleInLibrary = sql`${games.hasAchievements} is not false`;

/**
 * Filters `gameIds` down to the ones worth asking the platform about, i.e.
 * drops games already known to have no achievements. Order is preserved.
 */
export async function withoutKnownNoAchievementGames(
  db: Db,
  gameIds: string[],
): Promise<string[]> {
  if (gameIds.length === 0) return [];

  const rows = await db
    .select({ id: games.id })
    .from(games)
    .where(and(inArray(games.id, gameIds), isVisibleInLibrary));
  const checkable = new Set(rows.map((r) => r.id));

  return gameIds.filter((id) => checkable.has(id));
}
