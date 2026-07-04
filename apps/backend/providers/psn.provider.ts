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

type GameTrophiesResult =
  | { status: "ok"; trophies: PsnTrophy[] }
  | { status: "empty" }
  | { status: "error" };

export class PsnProvider {
  // ── Auth ──────────────────────────────────────────────────────────────────

  async exchangeNpsso(npsso: string): Promise<PsnAuthTokens> {
    try {
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      const auth = await exchangeAccessCodeForAuthTokens(accessCode);

      return {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        accessTokenExpiresAt: Date.now() + auth.expiresIn * 1000,
      };
    } catch (error) {
      console.error("[PsnProvider][exchangeNpsso] Failed:", error);
      throw new Error(
        "Failed to exchange NPSSO for PSN tokens — is the NPSSO valid?",
      );
    }
  }

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
  async getProfile(
    accessToken: string,
    onlineId: string,
  ): Promise<PsnProfile | null> {
    try {
      const auth = { accessToken };

      const response = await getProfileFromUserName(auth, onlineId);

      if (!response?.profile) return null;

      return {
        accountId: response.profile.accountId,
        onlineId: response.profile.onlineId,
        avatarUrl: response.profile.avatarUrls?.[0]?.avatarUrl ?? null,
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
      const { trophyTitles } = await getUserTitles(auth, "me", {
        limit: 800,
        offset: 0,
      });

      const withTrophies = trophyTitles.filter((title) => {
        const defined = title.definedTrophies;
        const total =
          (defined?.bronze ?? 0) +
          (defined?.silver ?? 0) +
          (defined?.gold ?? 0) +
          (defined?.platinum ?? 0);
        if (total === 0) {
          console.debug(
            `[PsnProvider] Skipping "${title.trophyTitleName}" — no trophies defined`,
          );
          return false;
        }
        return true;
      });

      console.debug(
        `[PsnProvider] getOwnedGames: ${trophyTitles.length} titles → ${withTrophies.length} with trophies`,
      );

      return withTrophies.map((title) => {
        const npServiceName: "trophy" | "trophy2" =
          title.npServiceName === "trophy2" ? "trophy2" : "trophy";
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

  async getGameTrophies(
    accessToken: string,
    npCommunicationId: string,
    npServiceName: "trophy" | "trophy2",
  ): Promise<GameTrophiesResult> {
    const auth = { accessToken };
    const serviceOptions =
      npServiceName === "trophy" ? { npServiceName: "trophy" as const } : {};

    try {
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

      if (!metaResponse.trophies?.length) {
        return { status: "empty" };
      }

      const earnedMap = new Map(
        (earnedResponse.trophies ?? []).map((t) => [t.trophyId, t]),
      );

      const trophies: PsnTrophy[] = metaResponse.trophies.map((meta) => {
        const earned = earnedMap.get(meta.trophyId);

        const earnedDateTime =
          earned?.earned && earned.earnedDateTime
            ? new Date(earned.earnedDateTime)
            : null;

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

      return { status: "ok", trophies };
    } catch (error) {
      console.error(
        `[PsnProvider][getGameTrophies] Failed for ${npCommunicationId}:`,
        error,
      );
      return { status: "error" };
    }
  }
}
