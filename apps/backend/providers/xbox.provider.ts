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

export class XboxProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://xbl.io/api/v2";

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

  // ── Shared request helpers ─────────────────────────────────────────────

  // Centralizes status handling for both GET (`get`) and POST (`post`) so
  // every method fails the same way for the same conditions.
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

  // For endpoints where a failure shouldn't be fatal to the caller — logs
  // and returns null instead of throwing, whatever went wrong.
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

  // OpenXBL wraps every response in { content, code }. A non-ok HTTP status
  // already throws inside request(); this catches the other failure mode —
  // HTTP 200 with a failure signaled inside the envelope itself.
  private isEnvelopeOk(code: number | undefined, context: string): boolean {
    if (code !== undefined && code >= 400) {
      console.error(
        `[XboxProvider][${context}] OpenXBL envelope reported code=${code}`,
      );
      return false;
    }
    return true;
  }

  // Guards against a malformed numeric string silently becoming NaN and
  // flowing into the DB.
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
    // Only count it as achieved if we actually got a usable unlock time —
    // an unparseable timestamp shouldn't produce achieved=true with a null
    // date, which would be an inconsistent state for a caller to handle.
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

  // ── Public API ────────────────────────────────────────────────────────

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
      // OpenXBL can return an empty achievements array alongside a nonzero
      // totalRecords — a partial/truncated response, not genuine emptiness.
      // Only trust "empty" when totalRecords agrees; otherwise this looks
      // like a transient failure, and the caller (which deletes the game on
      // a genuine "empty" status) shouldn't act on it as if it were one.
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
