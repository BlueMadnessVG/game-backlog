import { eq } from "drizzle-orm";
import { users, steamAccounts, steamGames, games } from "../../db/schema";
import type { DbClient } from "../../db";
import { SteamProvider } from "../../providers/steam.provider";
import { sql } from "drizzle-orm";

export class SteamService {
  constructor(
    private readonly db: DbClient,
    private readonly provider: SteamProvider,
  ) {}

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
          set: {
            lastSync: new Date(),
          },
        });

      return steamData;
    });
  }

  async syncUserGames(localUserId: string, steamId: string) {
    const steamGamesList = await this.provider.getOwnedGames(steamId);
    if (!steamGamesList.length) return [];

    return await this.db.transaction(async (tx) => {
      const insertedGames = await tx
        .insert(games)
        .values(
          steamGamesList.map((g) => ({
            title: g.name,
            platform: "PC",
            coverUrl: g.iconUrl,
            // Note: If 'playTime' is global, update it.
            // If it's per-user, this should move to 'userGames'.
            playTime: g.playtimeMinutes,
          })),
        )
        .onConflictDoUpdate({
          target: [games.title],
          set: {
            coverUrl: sql`excluded.cover_url`,
            playTime: sql`excluded.play_time`,
          },
        })
        .returning();

      const steamToInternalMap = insertedGames.map((gameRecord) => {
        const steamGame = steamGamesList.find(
          (sg) => sg.name === gameRecord.title,
        );
        return {
          gameId: gameRecord.id,
          steamAppId: steamGame!.steamAppId,
        };
      });

      await tx
        .insert(steamGames)
        .values(steamToInternalMap)
        .onConflictDoNothing();

      await tx
        .update(steamAccounts)
        .set({ lastSync: new Date() })
        .where(eq(steamAccounts.steamId, steamId));

      return insertedGames;
    });
  }
}
