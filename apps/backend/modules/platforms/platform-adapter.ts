import type { GenericSchema } from "valibot";

import type { DbClient } from "../../db";

export type PlatformKey = "steam" | "xbox" | "playstation";

/**
 * A game the user owns, as the platform reports it. Optional numbers are
 * `null` when the platform simply doesn't have that fact (PSN has no play
 * time; Steam reports completion only through its achievements), which tells
 * the engine to leave the stored value alone instead of overwriting it with 0.
 */
export type OwnedGame = {
  /** The platform's own id: Steam app id, Xbox title id, PSN npCommunicationId. */
  externalId: string;
  title: string;
  iconUrl: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  playTimeMinutes: number | null;
  lastPlayedAt: Date | null;
  completionPercentage: number | null;
  platinumEarned?: boolean;
  /** Passed back to `fetchAchievements`; stored on the catalog row. */
  metadata?: Record<string, unknown>;
};

export type NormalizedAchievement = {
  /** The platform's key: Steam apiName, Xbox achievement id, PSN trophyId. */
  externalKey: string;
  name: string;
  description: string | null;
  hidden: boolean;
  iconUrl: string | null;
  iconGrayUrl: string | null;
  globalPercentage: number | null;
  /** Xbox gamerscore. */
  points: number | null;
  /** PSN trophy type; `"platinum"` is what marks a game completed. */
  tier: string | null;
  achieved: boolean;
  unlockedAt: Date | null;
};

/**
 * What the platform said about a game's achievements.
 *  - `ok`: here they are.
 *  - `empty`: the platform answered, and the game has none.
 *  - `error`: the lookup failed; nothing is known. This must never be reported
 *    as `empty`, because `empty` hides the game for every user who owns it.
 */
export type AchievementsOutcome =
  | { status: "ok"; achievements: NormalizedAchievement[] }
  | { status: "empty" }
  | { status: "error" };

/**
 * Everything that differs between Steam, Xbox and PSN, and nothing else.
 * The storage, batching, rate limiting, status derivation, paging and
 * ownership rules are the same for all three and live in `PlatformLibrary`.
 *
 * `Account` is whatever `loadAccount` needs to hand to the fetch calls (a
 * Steam id, an Xbox xuid, a PSN access token).
 */
export interface PlatformAdapter<Account = unknown, LinkBody = unknown> {
  readonly platform: PlatformKey;
  /** Achievement sync concurrency and the pause between batches (API rate limits). */
  readonly batch: { readonly size: number; readonly delayMs: number };
  /** Whether covers are missing from the platform and should be filled in from IGDB. */
  readonly enrichCovers: boolean;
  /** Validates the body of `POST /<platform>/sync`. */
  readonly linkSchema: GenericSchema<LinkBody>;

  /**
   * Stores the user's account for this platform (and updates their username)
   * and returns the profile to show in the response.
   */
  link(db: DbClient, userId: string, body: LinkBody): Promise<object>;
  /** The linked account, ready to use, or `null` when the user hasn't linked one. */
  loadAccount(db: DbClient, userId: string): Promise<Account | null>;
  fetchOwnedGames(account: Account): Promise<OwnedGame[]>;
  fetchAchievements(
    account: Account,
    game: { externalId: string; metadata: Record<string, unknown> | null },
  ): Promise<AchievementsOutcome>;
}
