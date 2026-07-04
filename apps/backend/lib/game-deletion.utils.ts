// services/library/game-deletion.util.ts
import { eq } from "drizzle-orm";
import {
  games,
  steamGames,
  xboxGames,
  psnGames,
  achievements,
} from "../db/schema";
import type { DbClient } from "../db";

// Deletes a game and every platform-specific row tied to it.
//
// Written to NOT depend on FK cascade behavior, since steamGames.gameId
// currently has no onDelete rule (see schema) — if that migration lands
// later, these explicit deletes become redundant but still safe/correct,
// so there's no rush to update this once it does.
//
// achievements has no FK to games at all (matched by steamAppId, a plain
// varchar) — Postgres can never cascade this one automatically, so it
// must always be deleted explicitly here regardless of any future migration.
export async function deleteGameAndRelations(
  db: DbClient,
  gameId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [steamMapping] = await tx
      .select({ steamAppId: steamGames.steamAppId })
      .from(steamGames)
      .where(eq(steamGames.gameId, gameId))
      .limit(1);

    if (steamMapping) {
      // userAchievements cascades from achievements via its own FK
      // (onDelete: "cascade" on achievementId), so this also cleans
      // up user unlock state for the deleted achievements.
      await tx
        .delete(achievements)
        .where(eq(achievements.steamAppId, steamMapping.steamAppId));
      await tx.delete(steamGames).where(eq(steamGames.gameId, gameId));
    }

    // xboxGames/psnGames cascade automatically via onDelete: "cascade",
    // but deleting explicitly keeps this function self-sufficient and
    // not reliant on schema state elsewhere — harmless no-op if the
    // row doesn't exist for this platform.
    await tx.delete(xboxGames).where(eq(xboxGames.gameId, gameId));
    await tx.delete(psnGames).where(eq(psnGames.gameId, gameId));

    await tx.delete(games).where(eq(games.id, gameId));
  });
}

// Batch variant — used by LibraryService for bulk cleanup runs, so we're
// not opening/committing a transaction per row when removing many games
// at once (e.g. a full-library re-sync cleanup).
export async function deleteGamesAndRelations(
  db: DbClient,
  gameIds: string[],
): Promise<number> {
  let deleted = 0;
  for (const gameId of gameIds) {
    await deleteGameAndRelations(db, gameId);
    deleted++;
  }
  return deleted;
}
