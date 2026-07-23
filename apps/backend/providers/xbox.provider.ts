import * as v from "valibot";
import {
  XboxProfileSchema,
  XboxTitleHistorySchema,
  XboxPlayerStatSchema,
  XboxAchievementsResponseSchema,
  type XboxAchievementSchema,
} from "./schemas/xbox.schemas";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from "../lib/provider-error.utils";

type XboxAchievementResult = {
  apiName: string;
  name: string;
  description: string | null;
  isSecret: boolean;
  iconUrl: string | null;
  gamerscore: number;
  achieved: boolean;
  unlockedAt: Date | null;
  globalPercentage: number | null;
};

type PlayerAchievementsResult =
  | { status: "ok"; achievements: XboxAchievementResult[] }
  | { status: "empty" }
  | { status: "error" };

type XboxAchievementRewards = v.InferOutput<
  typeof XboxAchievementSchema
>["rewards"];

/**
 * Low-level wrapper around the OpenXBL API, handling authentication,
 * player profile lookups, title-history fetches, playtime resolution, and
 * achievement retrieval.
 *
 * @remarks
 * OpenXBL wraps every response in a `{ content, code }` envelope. HTTP
 * status codes are handled by {@link XboxProvider.request}, while
 * non-200 `code` values inside the envelope are checked by
 * {@link XboxProvider.isEnvelopeOk}.
 *
 * @example
 * ```ts
 * const xbox = new XboxProvider("openxbl-api-key");
 * const profile = await xbox.getPlayerProfile("2535428556301458");
 * ```
 */
export class XboxProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://xbl.io/api/v2";

  /**
   * Creates a new Xbox provider.
   *
   * @param apiKey - OpenXBL API key.
   * @throws {Error} When `apiKey` is falsy.
   *
   * @example
   * ```ts
   * const xbox = new XboxProvider(process.env.OPENXBL_API_KEY!);
   * ```
   */
  constructor(apiKey: string) {
    if (!apiKey) throw new Error("OPENXBL_API_KEY is missing");
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      "X-Authorization": this.apiKey,
      Accept: "application/json",
      "Accept-Language": "en-US",
    };
  }

  /**
   * Performs a fetch with standardised HTTP status handling.
   *
   * @remarks
   * Status codes are classified as follows:
   * - `401` → {@link ProviderAuthError}
   * - `429` → {@link ProviderRateLimitError}
   * - Other non-2xx → {@link ProviderUnavailableError}
   *
   * @param url - The URL to fetch.
   * @param init - Optional `RequestInit` overrides (method, body, etc.).
   * @returns Parsed JSON response typed as `T`.
   * @throws {ProviderAuthError} On 401 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} On other non-2xx responses.
   */
  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init.headers ?? {}) },
    });

    if (response.status === 401) {
      throw new ProviderAuthError(
        "XboxProvider",
        "Invalid or expired OpenXBL API key",
      );
    }
    if (response.status === 429) {
      throw new ProviderRateLimitError(
        "XboxProvider",
        "OpenXBL rate limit exceeded (150 req/hr on free tier)",
      );
    }
    if (!response.ok) {
      throw new ProviderUnavailableError(
        "XboxProvider",
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private get<T>(url: string): Promise<T> {
    return this.request<T>(url);
  }

  private post<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /**
   * A non-throwing variant of {@link XboxProvider.request} for endpoints
   * where failure is non-fatal.
   *
   * @remarks
   * Any error (network, auth, schema) is logged and `null` is returned.
   * Use this for nice-to-have data rather than required data.
   *
   * @param url - The URL to fetch.
   * @param init - `RequestInit` configuration for the fetch call.
   * @param context - Descriptive label included in the warning message.
   * @returns Parsed JSON response typed as `T`, or `null` when any error
   *   occurs.
   */
  private async safeRequest<T>(
    url: string,
    init: RequestInit,
    context: string,
  ): Promise<T | null> {
    try {
      return await this.request<T>(url, init);
    } catch (error) {
      console.warn(
        `[XboxProvider] ${context}: request failed, continuing without this data`,
        error,
      );
      return null;
    }
  }

  /**
   * Checks whether the OpenXBL envelope `code` indicates a failure.
   *
   * @remarks
   * OpenXBL wraps every response in `{ content, code }`. A non-ok HTTP
   * status already throws inside {@link XboxProvider.request}; this
   * catches the other failure mode — HTTP 200 with a failure signaled
   * inside the envelope itself.
   *
   * @param code - The `code` value from the OpenXBL response envelope.
   * @param context - Descriptive label included in the error log.
   * @returns `true` when the envelope is healthy, `false` when a failure
   *   was detected.
   */
  private isEnvelopeOk(code: number | undefined, context: string): boolean {
    if (code !== undefined && code >= 400) {
      console.error(
        `[XboxProvider][${context}] OpenXBL envelope reported code=${code}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Safely parses a numeric string, defaulting to `0` when the value is
   * missing or unparseable.
   *
   * @param value - Raw numeric string from the API.
   * @param context - Descriptive label included in the warning message.
   * @returns The parsed number, or `0` as a safe default.
   */
  private toSafeNumber(
    value: string | null | undefined,
    context: string,
  ): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      console.warn(
        `[XboxProvider] ${context}: could not parse "${value}" as a number, defaulting to 0`,
      );
      return 0;
    }
    return parsed;
  }

  /**
   * Safely parses a date string, returning `null` and logging a warning
   * when the value cannot be parsed.
   *
   * @param value - Raw date string from the API.
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
        `[XboxProvider] ${context}: could not parse "${value}" as a date`,
      );
      return null;
    }
    return parsed;
  }

  private getSetting(
    settings: { id: string; value: string }[],
    key: string,
  ): string | null {
    return settings.find((s) => s.id === key)?.value ?? null;
  }

  private extractGamerscore(rewards: XboxAchievementRewards): number {
    const reward = rewards?.find((r) => r.type === "Gamerscore");
    return this.toSafeNumber(reward?.value, "achievement gamerscore reward");
  }

  private extractIconUrl(rewards: XboxAchievementRewards): string | null {
    const reward = rewards?.find((r) => r.mediaAsset?.type === "Icon");
    return reward?.mediaAsset?.url ?? null;
  }

  /**
   * Maps a raw Xbox achievement schema object to a flattened
   * {@link XboxAchievementResult}.
   *
   * @remarks
   * An achievement is only marked as `achieved` when a parseable unlock
   * timestamp exists — an unparseable timestamp does not produce
   * `achieved: true` with a null date, which would be an inconsistent
   * state for callers.
   *
   * @param a - Raw achievement object from the Xbox API.
   * @param titleId - The title ID for context in log messages.
   * @returns A flattened achievement result.
   */
  private mapAchievement(
    a: v.InferOutput<typeof XboxAchievementSchema>,
    titleId: string,
  ): XboxAchievementResult {
    const timeUnlocked = a.progression?.timeUnlocked;
    const hasUnlockTime = !!timeUnlocked && timeUnlocked !== "";
    const unlockedAt = hasUnlockTime
      ? this.parseDateSafe(
          timeUnlocked,
          `achievement ${a.id} (title ${titleId}) unlock time`,
        )
      : null;
    const achieved = hasUnlockTime && unlockedAt !== null;

    return {
      apiName: a.id,
      name: a.name,
      description: a.description ?? null,
      isSecret: a.isSecret ?? false,
      iconUrl: this.extractIconUrl(a.rewards),
      gamerscore: this.extractGamerscore(a.rewards),
      achieved,
      unlockedAt,
      globalPercentage: a.rarity?.currentPercentage ?? null,
    };
  }

  /**
   * Fetches an Xbox player's profile by XUID.
   *
   * @param xuid - The Xbox User ID to look up.
   * @returns Profile data including gamertag, avatar URL, and gamerscore,
   *   or `null` when no profile is found.
   * @throws {ProviderAuthError} On 401 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} When the response does not match
   *   the expected schema or the OpenXBL envelope reports a failure.
   *
   * @example
   * ```ts
   * const profile = await xbox.getPlayerProfile("2535428556301458");
   * if (profile) {
   *   console.log(profile.gamertag);
   * }
   * ```
   */
  async getPlayerProfile(xuid: string) {
    const rawData = await this.get(`${this.baseUrl}/account/${xuid}`);
    const result = v.safeParse(XboxProfileSchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getPlayerProfile] Schema error:",
        JSON.stringify(v.flatten(result.issues).nested, null, 2),
      );
      throw new ProviderUnavailableError(
        "XboxProvider",
        "Profile response did not match expected schema",
      );
    }

    if (!this.isEnvelopeOk(result.output.code, "getPlayerProfile")) {
      throw new ProviderUnavailableError(
        "XboxProvider",
        "OpenXBL reported a failure fetching the profile",
      );
    }

    const user = result.output.content.profileUsers[0];
    if (!user) return null;

    return {
      xuid: user.id,
      gamertag: this.getSetting(user.settings, "Gamertag") ?? "Unknown",
      avatarUrl: this.getSetting(user.settings, "GameDisplayPicRaw"),
      gamerscore: this.toSafeNumber(
        this.getSetting(user.settings, "Gamerscore"),
        "profile gamerscore",
      ),
    };
  }

  /**
   * Fetches a player's full title history, filtered to titles that have
   * at least one defined achievement.
   *
   * @remarks
   * Titles with zero defined achievements are excluded. Playtime is
   * always `0` in the returned objects — the Xbox title-history endpoint
   * does not expose playtime; use {@link XboxProvider.getPlaytimeMinutes}
   * for that data.
   *
   * @param xuid - The Xbox User ID to fetch title history for.
   * @returns Array of owned game objects with cover URLs, completion
   *   percentages, and last-played timestamps.
   * @throws {ProviderAuthError} On 401 responses.
   * @throws {ProviderRateLimitError} On 429 responses.
   * @throws {ProviderUnavailableError} When the response does not match
   *   the expected schema or the OpenXBL envelope reports a failure.
   *
   * @example
   * ```ts
   * const titles = await xbox.getOwnedGames("2535428556301458");
   * console.log(`${titles.length} titles with achievements`);
   * ```
   */
  async getOwnedGames(xuid: string) {
    const rawData = await this.get(
      `${this.baseUrl}/player/titleHistory/${xuid}`,
    );
    const result = v.safeParse(XboxTitleHistorySchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getOwnedGames] Schema error:",
        v.flatten(result.issues),
      );
      throw new ProviderUnavailableError(
        "XboxProvider",
        "Title history response did not match expected schema",
      );
    }

    if (!this.isEnvelopeOk(result.output.code, "getOwnedGames")) {
      throw new ProviderUnavailableError(
        "XboxProvider",
        "OpenXBL reported a failure fetching title history",
      );
    }

    const titles = result.output.content.titles ?? [];

    const withAchievements = titles.filter((title) => {
      const total = title.achievement?.totalAchievements ?? 0;
      if (total === 0) {
        console.debug(
          `[XboxProvider] Skipping "${title.name}" — no achievements defined`,
        );
        return false;
      }
      return true;
    });

    console.debug(
      `[XboxProvider] getOwnedGames: ${titles.length} titles → ${withAchievements.length} with achievements`,
    );

    return withAchievements.map((title) => ({
      titleId: title.titleId,
      name: title.name,
      coverUrl: title.displayImage ?? null,
      playtimeMinutes: 0,
      lastPlayedAt: this.parseDateSafe(
        title.titleHistory?.lastTimePlayed,
        `title ${title.titleId} lastTimePlayed`,
      ),
      completionPercentage: title.achievement?.progressPercentage ?? 0,
    }));
  }

  /**
   * Fetches per-title `MinutesPlayed` stats for a batch of titles in a
   * single request.
   *
   * @remarks
   * Uses a non-throwing fetch via {@link XboxProvider.safeRequest} — a
   * failure returns an empty map rather than throwing, since playtime is
   * supplementary data.
   *
   * @param xuid - The Xbox User ID to fetch playtime for.
   * @param titleIds - Array of title IDs to query.
   * @returns A `Map` from title ID (as string) to minutes played (rounded
   *   to the nearest integer). An empty map is returned when the API fails
   *   or the input is empty.
   *
   * @example
   * ```ts
   * const playtimes = await xbox.getPlaytimeMinutes("2535428556301458", [
   *   "710669680",
   *   "1096135857",
   * ]);
   * console.log(playtimes.get("710669680")); // 142
   * ```
   */
  async getPlaytimeMinutes(
    xuid: string,
    titleIds: string[],
  ): Promise<Map<string, number>> {
    if (!titleIds.length) return new Map();

    const rawData = await this.safeRequest<unknown>(
      `${this.baseUrl}/player/stats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xuids: [xuid],
          stats: titleIds.map((titleId) => ({
            name: "MinutesPlayed",
            titleId,
          })),
        }),
      },
      "getPlaytimeMinutes",
    );

    if (rawData === null) return new Map();

    const result = v.safeParse(XboxPlayerStatSchema, rawData);

    if (!result.success) {
      console.warn(
        "[XboxProvider][getPlaytimeMinutes] Schema mismatch:",
        v.flatten(result.issues),
      );
      return new Map();
    }

    if (!this.isEnvelopeOk(result.output.code, "getPlaytimeMinutes")) {
      return new Map();
    }

    const playtimeMap = new Map<string, number>();
    const stats = result.output.content.statlistscollection?.[0]?.stats ?? [];

    for (const stat of stats) {
      if (stat.name === "MinutesPlayed" && stat.titleid && stat.value) {
        playtimeMap.set(
          stat.titleid,
          Math.round(
            this.toSafeNumber(stat.value, `playtime for title ${stat.titleid}`),
          ),
        );
      }
    }

    return playtimeMap;
  }

  /**
   * Fetches a player's achievement progress for a single game.
   *
   * @remarks
   * OpenXBL can return an empty `achievements` array alongside a nonzero
   * `totalRecords` — a partial/truncated response rather than genuine
   * emptiness. This is treated as a transient failure (`status: "error"`)
   * rather than `"empty"`, since the caller deletes games on a genuine
   * empty status and should not act on truncated data.
   *
   * @param xuid - The Xbox User ID of the player.
   * @param titleId - The Xbox title ID to fetch achievements for.
   * @returns A {@link PlayerAchievementsResult} discriminated union:
   *   - `{ status: "ok", achievements }` — achievements found and returned.
   *   - `{ status: "empty" }` — game genuinely has zero achievements.
   *   - `{ status: "error" }` — API call failed, schema mismatch, or
   *     truncated response (error already logged).
   *
   * @example
   * ```ts
   * const result = await xbox.getPlayerAchievements(
   *   "2535428556301458",
   *   "710669680",
   * );
   * if (result.status === "ok") {
   *   console.log(`${result.achievements.length} achievements`);
   * }
   * ```
   */
  async getPlayerAchievements(
    xuid: string,
    titleId: string,
  ): Promise<PlayerAchievementsResult> {
    let rawData: unknown;
    try {
      rawData = await this.get(
        `${this.baseUrl}/achievements/player/${xuid}/${titleId}`,
      );
    } catch (error) {
      console.error(
        `[XboxProvider][getPlayerAchievements] Fetch failed for title ${titleId}:`,
        error,
      );
      return { status: "error" };
    }

    const result = v.safeParse(XboxAchievementsResponseSchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getPlayerAchievements] Schema error:",
        v.flatten(result.issues),
      );
      return { status: "error" };
    }

    if (!this.isEnvelopeOk(result.output.code, "getPlayerAchievements")) {
      return { status: "error" };
    }

    const achievements = result.output.content.achievements ?? [];
    const totalRecords = result.output.content.pagingInfo?.totalRecords ?? 0;

    if (!achievements.length) {
      if (totalRecords > 0) {
        console.warn(
          `[XboxProvider][getPlayerAchievements] title ${titleId}: empty achievements array but totalRecords=${totalRecords} — treating as a transient failure, not genuine emptiness`,
        );
        return { status: "error" };
      }
      return { status: "empty" };
    }

    return {
      status: "ok",
      achievements: achievements.map((a) => this.mapAchievement(a, titleId)),
    };
  }
}
