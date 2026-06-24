import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
} from "psn-api";
import type {
  PsnAuthTokens,
  PsnProfile,
  PsnTitle,
  PsnTrophy,
} from "./schemas/psn.schemas";

export class PsnProvider {
  // ── Auth ──────────────────────────────────────────────────────────────────

  // Exchange a raw NPSSO token (from the PSN website cookie) for OAuth tokens.
  // Called once on first sync — tokens are stored in psn_accounts after this.
  async exchangeNpsso(npsso: string): Promise<PsnAuthTokens> {
    try {
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      const auth = await exchangeAccessCodeForAuthTokens(accessCode);

      return {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        // PSN returns expiresIn in seconds — convert to absolute ms timestamp
        accessTokenExpiresAt: Date.now() + auth.expiresIn * 1000,
      };
    } catch (error) {
      console.error("[PsnProvider][exchangeNpsso] Failed:", error);
      throw new Error(
        "Failed to exchange NPSSO for PSN tokens — is the NPSSO valid?",
      );
    }
  }

  // Refresh an expired access token using the stored refresh token.
  // Called automatically by the service before any API call when needed.
  async refreshTokens(refreshToken: string): Promise<PsnAuthTokens> {
    try {
      const auth = await exchangeRefreshTokenForAuthTokens(refreshToken);

      return {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        accessTokenExpiresAt: Date.now() + auth.expiresIn * 1000,
      };
    } catch (error) {
      console.error("[PsnProvider][refreshTokens] Failed:", error);
      throw new Error(
        "PSN refresh token is expired or invalid — user must re-authenticate",
      );
    }
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  // onlineId is the PSN display name (e.g. "BlueMadness9897").
  // getProfileFromUserName is used because it's the only endpoint that
  // returns accountId reliably — getProfileFromAccountId requires the
  // accountId already, which we don't have on first sync.
  async getProfile(
    accessToken: string,
    onlineId: string,
  ): Promise<PsnProfile | null> {
    try {
      const auth = { accessToken };

      // Returns profile fields inside a `profile` object
      const response = await getProfileFromUserName(auth, onlineId);

      if (!response?.profile) return null;

      return {
        accountId: response.profile.accountId,
        onlineId: response.profile.onlineId,
        // avatarUrls is Array<{ size: string; avatarUrl: string }>
        avatarUrl: response.profile.avatarUrls?.[0]?.avatarUrl ?? null,
        // Tokens are not returned by this endpoint — caller already has them
        tokens: { accessToken, refreshToken: "", accessTokenExpiresAt: 0 },
      };
    } catch (error) {
      console.error("[PsnProvider][getProfile] Failed:", error);
      throw new Error("Could not fetch PSN profile");
    }
  }

  // ── Games (Trophy Titles) ─────────────────────────────────────────────────

  async getOwnedGames(accessToken: string): Promise<PsnTitle[]> {
    const auth = { accessToken };

    try {
      // PSN max per call is 800 — fetch all in one shot
      const { trophyTitles } = await getUserTitles(auth, "me", {
        limit: 800,
        offset: 0,
      });

      return trophyTitles.map((title) => {
        // npServiceName: "trophy" required for PS3/PS4/Vita, "trophy2" for PS5
        const npServiceName: "trophy" | "trophy2" =
          title.npServiceName === "trophy2" ? "trophy2" : "trophy";

        // Platinum is earned when earnedTrophies.platinum >= 1.
        // Not all games have a platinum (e.g. small indie titles).
        const platinumEarned = (title.earnedTrophies?.platinum ?? 0) >= 1;

        return {
          npCommunicationId: title.npCommunicationId,
          name: title.trophyTitleName,
          iconUrl: title.trophyTitleIconUrl ?? null,
          trophyTitlePlatform: title.trophyTitlePlatform ?? "PS5",
          npServiceName,
          completionPercentage: title.progress ?? 0,
          platinumEarned,
          lastUpdatedDateTime: title.lastUpdatedDateTime ?? null,
        };
      });
    } catch (error) {
      console.error("[PsnProvider][getOwnedGames] Failed:", error);
      throw new Error("Could not fetch PSN game library");
    }
  }

  // ── Trophies ──────────────────────────────────────────────────────────────

  // Fetches both trophy metadata (name, icon, type) AND user earn state
  // in parallel, then merges them — same pattern as Steam's getGameSchema +
  // getPlayerAchievements, but in one method since PSN has two separate calls.
  async getGameTrophies(
    accessToken: string,
    npCommunicationId: string,
    npServiceName: "trophy" | "trophy2",
  ): Promise<PsnTrophy[] | null> {
    const auth = { accessToken };

    // npServiceName option is required for PS3/PS4/Vita titles.
    // Passing it for PS5 is harmless — psn-api ignores it.
    const serviceOptions =
      npServiceName === "trophy" ? { npServiceName: "trophy" as const } : {};

    try {
      // Parallel fetch: metadata (name, icon, description) + user earn state
      const [metaResponse, earnedResponse] = await Promise.all([
        getTitleTrophies(auth, npCommunicationId, "all", serviceOptions),
        getUserTrophiesEarnedForTitle(
          auth,
          "me",
          npCommunicationId,
          "all",
          serviceOptions,
        ),
      ]);

      if (!metaResponse.trophies?.length) return null;

      // Build a map of trophyId → earn state for fast lookup
      const earnedMap = new Map(
        (earnedResponse.trophies ?? []).map((t) => [t.trophyId, t]),
      );

      return metaResponse.trophies.map((meta) => {
        const earned = earnedMap.get(meta.trophyId);

        const earnedDateTime =
          earned?.earned && earned.earnedDateTime
            ? new Date(earned.earnedDateTime)
            : null;

        // trophyEarnedRate lives on UserThinTrophy (earned), not TitleThinTrophy (meta)
        const rawRate = earned?.trophyEarnedRate ?? null;
        const trophyEarnedRate =
          rawRate != null ? parseFloat(String(rawRate)) : null;

        return {
          trophyId: String(meta.trophyId),
          name: meta.trophyName ?? "Unknown Trophy",
          detail: meta.trophyDetail ?? null,
          trophyType: meta.trophyType as
            | "bronze"
            | "silver"
            | "gold"
            | "platinum",
          trophyHidden: meta.trophyHidden ?? false,
          trophyIconUrl: meta.trophyIconUrl ?? null,
          trophyEarnedRate,
          earned: earned?.earned ?? false,
          earnedDateTime,
        };
      });
    } catch (error) {
      console.error(
        `[PsnProvider][getGameTrophies] Failed for ${npCommunicationId}:`,
        error,
      );
      // Return null so the service can skip this game gracefully
      return null;
    }
  }
}
