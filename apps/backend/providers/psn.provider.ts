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

/**
 * Low-level wrapper around the `psn-api` SDK, handling authentication,
 * profile lookups, game-library fetches, and trophy retrieval.
 *
 * @remarks
 * Error handling is best-effort: the `psn-api` SDK does not document a
 * stable error shape, so {@link PsnProvider.classifyError} inspects
 * numeric status codes and message patterns before falling back to
 * {@link ProviderUnavailableError}.
 *
 * All methods that accept an `accessToken` expect a valid, non-expired
 * PSN access token. Token management is handled by the caller
 * ({@link PsnService}).
 *
 * @example
 * ```ts
 * const psn = new PsnProvider();
 * const tokens = await psn.exchangeNpsso("npsso-value");
 * const profile = await psn.getProfile(tokens.accessToken, "MyPsnId");
 * ```
 */
export class PsnProvider {
  private buildAuth(accessToken: string) {
    return { accessToken };
  }

  /**
   * Classifies an unknown error into a typed provider error.
   *
   * @remarks
   * The `psn-api` SDK does not document a stable error shape. This method
   * looks for common signals (numeric `status`/`statusCode` property, or a
   * rate-limit-flavoured message) and falls back to
   * {@link ProviderUnavailableError}.
   *
   * @param error - The caught value to classify.
   * @param fallbackMessage - Message used when the error cannot be
   *   specifically classified.
   * @returns A {@link ProviderAuthError}, {@link ProviderRateLimitError},
   *   or {@link ProviderUnavailableError}.
   */
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

  /**
   * Safely parses a date string, returning `null` and logging a warning
   * when the value cannot be parsed.
   *
   * @param value - Raw date string from the PSN API.
   * @param context - Descriptive label included in the warning message.
   * @returns A `Date` instance, or `null` when the input is missing or
   *   unparseable.
   */
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

  /**
   * Safely parses a trophy-earned-rate value (which arrives as a string
   * from the PSN API) into a number.
   *
   * @param rawRate - Raw value from the PSN API (typically a string like
   *   `"45.3"`).
   * @param context - Descriptive label included in the warning message.
   * @returns A parsed number, or `null` when the input is missing or
   *   unparseable.
   */
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

  /**
   * Valid PSN trophy type values.
   */
  private static readonly TROPHY_TYPES = new Set([
    "bronze",
    "silver",
    "gold",
    "platinum",
  ]);

  /**
   * Validates and narraws a raw trophy-type string to the known set.
   *
   * @remarks
   * Unexpected values are logged and default to `"bronze"` rather than
   * being silently mistyped or dropped — showing a real trophy with a
   * possibly-wrong tier is preferred over hiding it.
   *
   * @param raw - Raw `trophyType` string from the PSN API.
   * @param context - Descriptive label included in the error log.
   * @returns One of `"bronze"`, `"silver"`, `"gold"`, or `"platinum"`.
   */
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

  /**
   * Exchanges a raw NPSSO cookie value for a full set of PSN auth tokens.
   *
   * @param npsso - The NPSSO cookie obtained from the PSN sign-in flow.
   * @returns A {@link PsnAuthTokens} object containing the access token,
   *   refresh token, and expiry timestamp.
   * @throws {ProviderAuthError} When the NPSSO is invalid or expired.
   *
   * @example
   * ```ts
   * const tokens = await psn.exchangeNpsso("npsso-value");
   * console.log(tokens.accessToken);
   * ```
   */
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
      throw new ProviderAuthError(
        "PsnProvider",
        "Failed to exchange NPSSO for PSN tokens — is the NPSSO valid?",
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  /**
   * Refreshes an expired PSN access token using a previously issued
   * refresh token.
   *
   * @param refreshToken - The refresh token from a prior
   *   {@link PsnProvider.exchangeNpsso} or
   *   {@link PsnProvider.refreshTokens} call.
   * @returns A fresh {@link PsnAuthTokens} object.
   * @throws {ProviderAuthError} When the refresh token is expired or
   *   invalid, requiring the user to re-authenticate via NPSSO.
   *
   * @example
   * ```ts
   * const fresh = await psn.refreshTokens(oldRefreshToken);
   * ```
   */
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

  /**
   * Fetches a PSN profile by online ID.
   *
   * @remarks
   * The return type deliberately excludes `tokens` — this call has no
   * refresh token to hand back. Callers that need the full profile+tokens
   * shape (e.g. {@link PsnService.syncUserProfile}) merge the real tokens
   * from {@link PsnProvider.exchangeNpsso} separately.
   *
   * @param accessToken - A valid PSN access token.
   * @param onlineId - The PSN online ID (gamertag) to look up.
   * @returns The profile data without tokens, or `null` when no profile is
   *   found.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} On other API failures.
   *
   * @example
   * ```ts
   * const profile = await psn.getProfile(accessToken, "MyPsnId");
   * if (profile) {
   *   console.log(profile.accountId);
   * }
   * ```
   */
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

  /**
   * Fetches the authenticated user's full list of owned trophy titles.
   *
   * @remarks
   * Titles with zero defined trophies are filtered out. The method
   * requests up to 800 titles in a single call, which is sufficient for
   * the vast majority of PSN accounts.
   *
   * @param accessToken - A valid PSN access token.
   * @returns Array of {@link PsnTitle} objects for all owned titles that
   *   have at least one defined trophy.
   * @throws {ProviderAuthError} On 401/403 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} On other API failures.
   *
   * @example
   * ```ts
   * const titles = await psn.getOwnedGames(accessToken);
   * console.log(`Found ${titles.length} titles with trophies`);
   * ```
   */
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

  /**
   * Fetches the full trophy list for a single game, merged with the
   * authenticated user's earned status.
   *
   * @remarks
   * Trophy metadata and user-earned data are fetched in parallel via
   * {@link getTitleTrophies} and {@link getUserTrophiesEarnedForTitle}.
   * Raw values are validated through {@link PsnProvider.parseTrophyType},
   * {@link PsnProvider.parseTrophyEarnedRate}, and
   * {@link PsnProvider.parseDateSafe} to prevent malformed API data from
   * reaching the database.
   *
   * @param accessToken - A valid PSN access token.
   * @param npCommunicationId - The PSN communication ID identifying the
   *   game's trophy set.
   * @param npServiceName - `"trophy"` for PS3/Vita titles or `"trophy2"`
   *   for PS4/PS5 titles.
   * @returns A {@link GameTrophiesResult} discriminated union:
   *   - `{ status: "ok", trophies }` — trophies found and returned.
   *   - `{ status: "empty" }` — game has zero defined trophies.
   *   - `{ status: "error" }` — API call failed (error already logged).
   *
   * @example
   * ```ts
   * const result = await psn.getGameTrophies(
   *   accessToken,
   *   "NPWR24757_00",
   *   "trophy2",
   * );
   * if (result.status === "ok") {
   *   console.log(`${result.trophies.length} trophies`);
   * }
   * ```
   */
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
