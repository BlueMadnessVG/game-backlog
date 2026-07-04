import * as v from "valibot";
import {
  XboxProfileSchema,
  XboxTitleHistorySchema,
  XboxPlayerStatSchema,
  XboxAchievementsResponseSchema,
  type XboxAchievementSchema,
} from "./schemas/xbox.schemas";

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

  private async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.headers() });

    if (response.status === 401) {
      throw new Error("[XboxProvider] Invalid or expired OpenXBL API key");
    }
    if (response.status === 429) {
      throw new Error(
        "[XboxProvider] OpenXBL rate limit exceeded (150 req/hr on free tier)",
      );
    }
    if (!response.ok) {
      throw new Error(
        `[XboxProvider] HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private getSetting(
    settings: { id: string; value: string }[],
    key: string,
  ): string | null {
    return settings.find((s) => s.id === key)?.value ?? null;
  }

  private mapAchievement(
    a: v.InferOutput<typeof XboxAchievementSchema>,
  ): XboxAchievementResult {
    const gamerscoreReward = a.rewards?.find((r) => r.type === "Gamerscore");
    const gamerscore = gamerscoreReward
      ? Number(gamerscoreReward.value ?? 0)
      : 0;

    const iconReward = a.rewards?.find((r) => r.mediaAsset?.type === "Icon");
    const iconUrl = iconReward?.mediaAsset?.url ?? null;

    const timeUnlocked = a.progression?.timeUnlocked;
    const achieved = !!timeUnlocked && timeUnlocked !== "";
    const unlockedAt = achieved ? new Date(timeUnlocked) : null;

    return {
      apiName: a.id,
      name: a.name,
      description: a.description ?? null,
      isSecret: a.isSecret ?? false,
      iconUrl,
      gamerscore,
      achieved,
      unlockedAt,
      globalPercentage: a.rarity?.currentPercentage ?? null,
    };
  }

  async getPlayerProfile(xuid: string) {
    const rawData = await this.fetch(`${this.baseUrl}/account/${xuid}`);
    const result = v.safeParse(XboxProfileSchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getPlayerProfile] Schema error:",
        JSON.stringify(v.flatten(result.issues).nested, null, 2),
      );
      throw new Error("OpenXBL API returned unexpected profile format");
    }

    const user = result.output.content.profileUsers[0];
    if (!user) return null;

    return {
      xuid: user.id,
      gamertag: this.getSetting(user.settings, "Gamertag") ?? "Unknown",
      avatarUrl: this.getSetting(user.settings, "GameDisplayPicRaw"),
      gamerscore: Number(this.getSetting(user.settings, "Gamerscore") ?? 0),
    };
  }

  async getOwnedGames(xuid: string) {
    const rawData = await this.fetch(
      `${this.baseUrl}/player/titleHistory/${xuid}`,
    );
    const result = v.safeParse(XboxTitleHistorySchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getOwnedGames] Schema error:",
        v.flatten(result.issues),
      );
      throw new Error("OpenXBL API returned unexpected title history format");
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

    return withAchievements.map((title) => {
      const lastPlayedRaw = title.titleHistory?.lastTimePlayed;
      const lastPlayedAt =
        lastPlayedRaw && lastPlayedRaw !== "" ? new Date(lastPlayedRaw) : null;

      return {
        titleId: title.titleId,
        name: title.name,
        coverUrl: title.displayImage ?? null,
        playtimeMinutes: 0,
        lastPlayedAt,
        completionPercentage: title.achievement?.progressPercentage ?? 0,
      };
    });
  }

  async getPlaytimeMinutes(
    xuid: string,
    titleIds: string[],
  ): Promise<Map<string, number>> {
    if (!titleIds.length) return new Map();

    const response = await fetch(`${this.baseUrl}/player/stats`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        xuids: [xuid],
        stats: titleIds.map((titleId) => ({ name: "MinutesPlayed", titleId })),
      }),
    });

    if (!response.ok) {
      console.warn(
        `[XboxProvider][getPlaytimeMinutes] Failed: ${response.statusText}`,
      );
      return new Map();
    }

    const rawData = await response.json();
    const result = v.safeParse(XboxPlayerStatSchema, rawData);

    if (!result.success) {
      console.warn(
        "[XboxProvider][getPlaytimeMinutes] Schema mismatch:",
        v.flatten(result.issues),
      );
      return new Map();
    }

    const playtimeMap = new Map<string, number>();

    const stats = result.output.content.statlistscollection?.[0]?.stats ?? [];

    for (const stat of stats) {
      if (stat.name === "MinutesPlayed" && stat.titleid && stat.value) {
        playtimeMap.set(stat.titleid, Math.round(Number(stat.value)));
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
      rawData = await this.fetch(
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

    const achievements = result.output.content.achievements ?? [];

    if (!achievements.length) {
      return { status: "empty" };
    }

    return {
      status: "ok",
      achievements: achievements.map((a) => this.mapAchievement(a)),
    };
  }
}
