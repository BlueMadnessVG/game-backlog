/**
 * Plain TypeScript shapes for the PSN provider (psn-api SDK) outputs — no
 * Valibot here, since the SDK's own types are trusted and the fields map
 * 1:1 onto the sync pipeline.
 *
 * Quirks worth knowing:
 *  - `npServiceName` differs by era: "trophy" for PS3/PS4/Vita, "trophy2"
 *    for PS5 — the trophy API requires it.
 *  - `trophyEarnedRate` is normalized to a number, but PSN returns it as a
 *    string (e.g. "45.3").
 *  - PSN exposes no raw playtime — `lastUpdatedDateTime` (last trophy sync)
 *    is the closest proxy.
 *  - `trophyId` is kept as a string for consistency with the other platform
 *    providers.
 *
 * Exports:
 *  - PsnAuthTokens, PsnProfile, PsnTitle, PsnTrophy.
 */
export type PsnAuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

export type PsnProfile = {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  tokens: PsnAuthTokens;
};

export type PsnTitle = {
  npCommunicationId: string;
  name: string;
  iconUrl: string | null;
  trophyTitlePlatform: string;
  npServiceName: "trophy" | "trophy2";
  completionPercentage: number;
  platinumEarned: boolean;
  lastUpdatedDateTime: string | null;
};

export type PsnTrophy = {
  trophyId: string;
  name: string;
  detail: string | null;
  trophyType: "bronze" | "silver" | "gold" | "platinum";
  trophyHidden: boolean;
  trophyIconUrl: string | null;
  trophyEarnedRate: number | null;
  earned: boolean;
  earnedDateTime: Date | null;
};
