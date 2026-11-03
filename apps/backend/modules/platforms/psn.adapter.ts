import { eq } from "drizzle-orm";
import { PsnSyncSchema } from "@repo/shared";

import { psnAccounts, users } from "../../db/schema";
import type { DbClient } from "../../db";
import { decrypt, encrypt } from "../../lib/Encryption.utils";
import { withLock, type AdvisoryLockClient } from "../../lib/locks";
import type { PsnProvider } from "../../providers/psn.provider";
import type {
  AchievementsOutcome,
  OwnedGame,
  PlatformAdapter,
} from "./platform-adapter";

/** What the fetch calls need: a PSN access token that is valid right now. */
type PsnAccount = { accessToken: string };
type PsnLinkBody = { npsso: string; onlineId: string };

/** An access token is treated as expired this long before it actually is. */
const EXPIRY_MARGIN_MS = 60_000;

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
};

/**
 * PlayStation Network, as far as the platform engine is concerned.
 *
 * @remarks
 * PSN is the one platform with real extra behavior, and all of it lives here:
 *  - **Tokens.** PSN gives short-lived access tokens, so {@link loadAccount}
 *    returns a *valid* one, refreshing it when needed. Tokens are stored
 *    AES-256-GCM encrypted and are never returned over HTTP.
 *  - **Per-game service name.** A title is either a `trophy` (PS3/PS4/Vita)
 *    or a `trophy2` (PS5) title and trophies must be fetched with the right
 *    one, so it travels with the game as catalog metadata.
 *  - **No play time.** PSN doesn't report it, so it is `null`, which tells the
 *    engine to leave any stored value alone.
 */
export class PsnAdapter implements PlatformAdapter<PsnAccount, PsnLinkBody> {
  readonly platform = "playstation" as const;
  readonly batch = { size: 5, delayMs: 500 };
  // PSN has no cover art in the trophy API, so covers come from IGDB.
  readonly enrichCovers = true;
  readonly linkSchema = PsnSyncSchema;

  constructor(
    private readonly provider: PsnProvider,
    private readonly lock?: AdvisoryLockClient,
  ) {}

  async link(db: DbClient, userId: string, body: PsnLinkBody) {
    const tokens = await this.provider.exchangeNpsso(body.npsso);
    const profile = await this.provider.getProfile(
      tokens.accessToken,
      body.onlineId,
    );
    if (!profile) {
      throw new Error(
        `Could not find PSN profile for online ID: ${body.onlineId}`,
      );
    }

    const stored = {
      accountId: profile.accountId,
      onlineId: profile.onlineId,
      avatarUrl: profile.avatarUrl,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
      lastSync: new Date(),
    };

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ username: profile.onlineId })
        .where(eq(users.id, userId));

      await tx
        .insert(psnAccounts)
        .values({ userId, ...stored })
        .onConflictDoUpdate({ target: psnAccounts.userId, set: stored });
    });

    // Deliberately not the tokens: this goes straight into the HTTP response.
    return {
      accountId: profile.accountId,
      onlineId: profile.onlineId,
      avatarUrl: profile.avatarUrl,
    };
  }

  async loadAccount(db: DbClient, userId: string): Promise<PsnAccount | null> {
    const account = await this.readTokens(db, userId);
    if (!account) return null;
    if (isFresh(account)) return { accessToken: account.accessToken };

    // Several requests can find the token expired at once (a batch of trophy
    // syncs). The lock makes them take turns, and the re-read lets the later
    // ones see the token the first one just refreshed instead of refreshing
    // again, which would invalidate the first one's token.
    const accessToken = await withLock(
      `psn-refresh:${userId}`,
      async () => {
        const current = await this.readTokens(db, userId);
        if (!current) return null;
        if (isFresh(current)) return current.accessToken;
        return this.refresh(db, userId, current.refreshToken);
      },
      this.lock ? { client: this.lock } : {},
    );

    return accessToken ? { accessToken } : null;
  }

  async fetchOwnedGames(account: PsnAccount): Promise<OwnedGame[]> {
    const titles = await this.provider.getOwnedGames(account.accessToken);

    return titles.map((title) => ({
      externalId: title.npCommunicationId,
      title: title.name,
      iconUrl: title.iconUrl,
      coverUrl: null,
      bannerUrl: null,
      // PSN doesn't expose play time.
      playTimeMinutes: null,
      lastPlayedAt: title.lastUpdatedDateTime
        ? new Date(title.lastUpdatedDateTime)
        : null,
      completionPercentage: title.completionPercentage,
      platinumEarned: title.platinumEarned,
      metadata: {
        npServiceName: title.npServiceName,
        trophyTitlePlatform: title.trophyTitlePlatform,
      },
    }));
  }

  async fetchAchievements(
    account: PsnAccount,
    game: { externalId: string; metadata: Record<string, unknown> | null },
  ): Promise<AchievementsOutcome> {
    const npServiceName =
      game.metadata?.npServiceName === "trophy" ? "trophy" : "trophy2";

    const result = await this.provider.getGameTrophies(
      account.accessToken,
      game.externalId,
      npServiceName,
    );
    if (result.status !== "ok") return result;

    return {
      status: "ok",
      achievements: result.trophies.map((t) => ({
        externalKey: t.trophyId,
        name: t.name,
        description: t.detail,
        hidden: t.trophyHidden,
        iconUrl: t.trophyIconUrl,
        iconGrayUrl: null,
        globalPercentage: t.trophyEarnedRate,
        points: null,
        // "platinum" is what marks a PSN game completed.
        tier: t.trophyType,
        achieved: t.earned,
        unlockedAt: t.earnedDateTime,
      })),
    };
  }

  private async readTokens(
    db: DbClient,
    userId: string,
  ): Promise<StoredTokens | null> {
    const [row] = await db
      .select({
        accessToken: psnAccounts.accessToken,
        refreshToken: psnAccounts.refreshToken,
        accessTokenExpiresAt: psnAccounts.accessTokenExpiresAt,
      })
      .from(psnAccounts)
      .where(eq(psnAccounts.userId, userId))
      .limit(1);
    if (!row) return null;

    return {
      accessToken: decrypt(row.accessToken),
      refreshToken: decrypt(row.refreshToken),
      accessTokenExpiresAt: row.accessTokenExpiresAt,
    };
  }

  private async refresh(
    db: DbClient,
    userId: string,
    refreshToken: string,
  ): Promise<string> {
    const next = await this.provider.refreshTokens(refreshToken);

    await db
      .update(psnAccounts)
      .set({
        accessToken: encrypt(next.accessToken),
        refreshToken: encrypt(next.refreshToken),
        accessTokenExpiresAt: new Date(next.accessTokenExpiresAt),
      })
      .where(eq(psnAccounts.userId, userId));

    // The plaintext token, not what was just stored: the caller has to
    // actually call PSN with it.
    return next.accessToken;
  }
}

function isFresh(tokens: StoredTokens): boolean {
  return Date.now() < tokens.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS;
}
