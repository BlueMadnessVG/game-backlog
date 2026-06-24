export type PsnAuthTokens = {
  accessToken: string;
  refreshToken: string;
  // Unix timestamp (ms) when the access token expires
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
  // Raw platform string from PSN e.g. "PS5", "PS4", "PS3,PSVITA"
  trophyTitlePlatform: string;
  // Required for trophy API calls — "trophy" for PS3/PS4/Vita, "trophy2" for PS5
  npServiceName: "trophy" | "trophy2";
  // Pre-computed from PSN (0–100)
  completionPercentage: number;
  // Whether the platinum trophy has been earned
  platinumEarned: boolean;
  // ISO 8601 string — last trophy sync date (PSN doesn't expose raw playtime)
  lastUpdatedDateTime: string | null;
};

export type PsnTrophy = {
  // Numeric trophy ID as string for consistency with other platforms
  trophyId: string;
  name: string;
  detail: string | null;
  trophyType: "bronze" | "silver" | "gold" | "platinum";
  trophyHidden: boolean;
  trophyIconUrl: string | null;
  // Global earn rate as number (PSN returns it as a string e.g. "45.3")
  trophyEarnedRate: number | null;
  earned: boolean;
  earnedDateTime: Date | null;
};
