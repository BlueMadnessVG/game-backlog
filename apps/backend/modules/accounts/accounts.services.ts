import { eq } from "drizzle-orm";
import type { LinkedAccounts, PlatformRoute } from "@repo/shared";

import type { DbClient } from "../../db";
import { psnAccounts, steamAccounts, xboxAccounts } from "../../db/schema";

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/**
 * Reads and removes the platform accounts a user has linked. Linking itself
 * lives in `PlatformLibrary.link` (POST /{platform}/sync), because it also
 * imports the library.
 */
export class AccountsService {
  constructor(private readonly db: DbClient) {}

  /** One entry per platform, `null` when not linked. Never returns PSN tokens. */
  async getLinked(userId: string): Promise<LinkedAccounts> {
    const [steam, xbox, psn] = await Promise.all([
      this.db
        .select({ steamId: steamAccounts.steamId, lastSync: steamAccounts.lastSync })
        .from(steamAccounts)
        .where(eq(steamAccounts.userId, userId))
        .limit(1),
      this.db
        .select({
          xuid: xboxAccounts.xuid,
          gamertag: xboxAccounts.gamertag,
          lastSync: xboxAccounts.lastSync,
        })
        .from(xboxAccounts)
        .where(eq(xboxAccounts.userId, userId))
        .limit(1),
      // Explicit column list: the row also holds the encrypted tokens.
      this.db
        .select({
          accountId: psnAccounts.accountId,
          onlineId: psnAccounts.onlineId,
          avatarUrl: psnAccounts.avatarUrl,
          lastSync: psnAccounts.lastSync,
        })
        .from(psnAccounts)
        .where(eq(psnAccounts.userId, userId))
        .limit(1),
    ]);

    return {
      steam: steam[0] ? { ...steam[0], lastSync: iso(steam[0].lastSync) } : null,
      xbox: xbox[0]
        ? { ...xbox[0], gamertag: xbox[0].gamertag ?? null, lastSync: iso(xbox[0].lastSync) }
        : null,
      psn: psn[0]
        ? {
            ...psn[0],
            onlineId: psn[0].onlineId ?? null,
            avatarUrl: psn[0].avatarUrl ?? null,
            lastSync: iso(psn[0].lastSync),
          }
        : null,
    };
  }

  /**
   * Removes the user's account for one platform. Only the link goes: games
   * and achievements already imported stay in the library.
   *
   * @returns whether an account was linked (and is now removed).
   */
  async unlink(userId: string, platform: PlatformRoute): Promise<boolean> {
    const table = { steam: steamAccounts, xbox: xboxAccounts, psn: psnAccounts }[platform];
    const removed = await this.db
      .delete(table)
      .where(eq(table.userId, userId))
      .returning({ userId: table.userId });
    return removed.length > 0;
  }
}
