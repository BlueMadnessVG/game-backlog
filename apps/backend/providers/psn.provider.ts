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
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from "../lib/provider-error.utils";

type GameTrophiesResult =
  | { status: "ok"; trophies: PsnTrophy[] }
  | { status: "empty" }
  | { status: "error" };

export class PsnProvider {
  // ── Shared helpers ────────────────────────────────────────────────────

  private buildAuth(accessToken: string) {
    return { accessToken };
  }

  // psn-api doesn't document a stable error shape, so this classification
  // is best-effort: it looks for common signals (a numeric status/
  // statusCode property, or a rate-limit-flavored message) and falls back
  // to a generic unavailable error otherwise. Treat this as a starting
  // point — worth tightening once we've seen what psn-api actually throws
  // in production rather than what its types suggest it might.
  private static classifyError(error: unknown, fallbackMessage: string): Error {
    const cause = error instanceof Error ? error : undefined;
    const status =
      (error as { status?: number; statusCode?: number } | undefined)?.status ??
      (error as { status?: number; statusCode?: number } | undefined)
        ?.statusCode;

    if (status === 401 || status === 403) {
      return new ProviderAuthError("PsnProvider", undefined, { cause });
    }
    if (status === 429) {
      return new ProviderRateLimitError("PsnProvider", undefined, { cause });
    }

    const message = error instanceof Error ? error.message : String(error);
    if (/rate.?limit/i.test(message)) {
      return new ProviderRateLimitError("PsnProvider", message, { cause });
    }

    return new ProviderUnavailableError("PsnProvider", fallbackMessage, {
      cause,
    });
  }

  // Guards against an unparseable date string becoming an Invalid Date that
  // only fails much later, wherever something calls .toISOString() on it.
  private parseDateSafe(
    value: string | null | undefined,
    context: string,
  ): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      console.warn(
        `[PsnProvider] ${context}: could not parse "${value}" as a date`,
      );
      return null;
    }
    return parsed;
  }

  // PSN's trophyEarnedRate arrives as a string (e.g. "45.3"). Guards
  // against a malformed value silently becoming NaN and flowing into the DB.
  private parseTrophyEarnedRate(
    rawRate: unknown,
    context: string,
  ): number | null {
    if (rawRate == null) return null;
    const parsed = parseFloat(String(rawRate));
    if (Number.isNaN(parsed)) {
      console.warn(
        `[PsnProvider] ${context}: could not parse trophyEarnedRate "${rawRate}"`,
      );
      return null;
    }
    return parsed;
  }

  private static readonly TROPHY_TYPES = new Set([
    "bronze",
    "silver",
    "gold",
    "platinum",
  ]);

  // Was previously a blind `as` cast on an unvalidated string from psn-api.
  // Validates against the known set instead — an unexpected value gets
  // logged loudly and defaulted rather than silently mistyped. Defaulting
  // to "bronze" (rather than dropping the trophy) is a deliberate choice:
  // showing a real trophy with a possibly-wrong tier beats hiding it.
  private parseTrophyType(
    raw: string,
    context: string,
  ): "bronze" | "silver" | "gold" | "platinum" {
    if (PsnProvider.TROPHY_TYPES.has(raw)) {
      return raw as "bronze" | "silver" | "gold" | "platinum";
    }
    console.error(
      `[PsnProvider] ${context}: unexpected trophyType "${raw}", defaulting to "bronze"`,
    );
    return "bronze";
  }

  // ── Auth ──────────────────────────────────────────────────────────────

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
      // Always an auth failure by construction (this call only ever fails
      // because the NPSSO is bad/expired), so no need to classify — but
      // the original error is preserved as `cause` for debugging.
      throw new ProviderAuthError(
        "PsnProvider",
        "Failed to exchange NPSSO for PSN tokens — is the NPSSO valid?",
        { cause: error instanceof Error ? error : undefined },
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
      throw new ProviderAuthError(
        "PsnProvider",
        "PSN refresh token is expired or invalid — user must re-authenticate",
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  // ── Profile ───────────────────────────────────────────────────────────

  // Return type deliberately excludes `tokens` — this call has no real
  // refresh token to hand back, and the previous version filled it with
  // placeholder values ("", 0) that were indistinguishable from real data
  // to anyone reading PsnProfile. Callers that need the full profile+tokens
  // shape (see PsnService.syncUserProfile) already merge in the real tokens
  // from exchangeNpsso separately — this just makes that contract explicit
  // in the type instead of implicit in call-site ordering.
  async getProfile(
    accessToken: string,
    onlineId: string,
  ): Promise<Omit<PsnProfile, "tokens"> | null> {
    try {
      const response = await getProfileFromUserName(
        this.buildAuth(accessToken),
        onlineId,
      );

      if (!response?.profile) return null;

      return {
        accountId: response.profile.accountId,
        onlineId: response.profile.onlineId,
        avatarUrl: response.profile.avatarUrls?.[0]?.avatarUrl ?? null,
      };
    } catch (error) {
      console.error("[PsnProvider][getProfile] Failed:", error);
      throw PsnProvider.classifyError(error, "Could not fetch PSN profile");
    }
  }

  // ── Games (Trophy Titles) ─────────────────────────────────────────────

  async getOwnedGames(accessToken: string): Promise<PsnTitle[]> {
    const auth = this.buildAuth(accessToken);

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

        if (!title.trophyTitlePlatform) {
          console.warn(
            `[PsnProvider] "${title.trophyTitleName}" (${title.npCommunicationId}) has no trophyTitlePlatform, defaulting to "PS5"`,
          );
        }

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
      throw PsnProvider.classifyError(
        error,
        "Could not fetch PSN game library",
      );
    }
  }

  // ── Trophies ──────────────────────────────────────────────────────────

  async getGameTrophies(
    accessToken: string,
    npCommunicationId: string,
    npServiceName: "trophy" | "trophy2",
  ): Promise<GameTrophiesResult> {
    const auth = this.buildAuth(accessToken);
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
        const context = `trophy ${meta.trophyId} (${npCommunicationId})`;

        const earnedDateTime =
          earned?.earned && earned.earnedDateTime
            ? this.parseDateSafe(
                earned.earnedDateTime,
                `${context} earnedDateTime`,
              )
            : null;

        return {
          trophyId: String(meta.trophyId),
          name: meta.trophyName ?? "Unknown Trophy",
          detail: meta.trophyDetail ?? null,
          trophyType: this.parseTrophyType(meta.trophyType, context),
          trophyHidden: meta.trophyHidden ?? false,
          trophyIconUrl: meta.trophyIconUrl ?? null,
          trophyEarnedRate: this.parseTrophyEarnedRate(
            earned?.trophyEarnedRate,
            `${context} earnedRate`,
          ),
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
