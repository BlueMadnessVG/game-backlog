import * as v from "valibot";
import {
  XboxProfileSchema,
  XboxTitleHistorySchema,
  XboxAchievementResponseSchema,
  XboxPlayerStatSchema,
} from "./schemas/xbox.schemas";

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

  async getPlayerProfile(xuid: string) {
    const rawData = await this.fetch(`${this.baseUrl}/account/${xuid}`);
    const result = v.safeParse(XboxProfileSchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getPlayerProfile] schema error:",
        JSON.stringify(v.flatten(result.issues).nested, null, 2),
      );
      throw new Error("OpenXBL API returned unexpected profile format");
    }

    const user = result.output.profileUsers[0];
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
      throw new Error("OpenXBL API return unexpected title history format");
    }

    const titles = result.output.title ?? [];

    return titles.map((title) => {
      const lastPlayedRaw = title.titleHistory?.lastTimePlayed;
      const lastPlayedAt =
        lastPlayedRaw && lastPlayedRaw !== "" ? new Date(lastPlayedRaw) : null;

      return {
        titleId: title.titleId,
        name: title.name,
        coverUrl: title.displayImage ?? null,
        // Xbox doesn't expose raw playtime in title history — fetched separately via player/stats
        playtimeMinutes: 0,
        lastPlayedAt,
        // Pre-computed completion from achievement summary in title history
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
        "[XboxProvider][getPlaytimeMinutes] Schema mismatch — returning empty map",
      );
      return new Map();
    }

    const playtimeMap = new Map<string, number>();

    for (const group of result.output.groups ?? []) {
      const titleId = group.titleId;
      if (!titleId) continue;
      const minutesStat = group.stats?.find((s) => s.name === "MinutesPlayed");
      if (minutesStat?.value) {
        playtimeMap.set(titleId, Math.round(Number(minutesStat.value)));
      }
    }

    return playtimeMap;
  }

  async getPlayerAchievements(xuid: string, titleId: string) {
    const url = `${this.baseUrl}/achievements/player/${xuid}/${titleId}`;
    const rawData = await this.fetch(url);
    const result = v.safeParse(XboxAchievementResponseSchema, rawData);

    if (!result.success) {
      console.error(
        "[XboxProvider][getPlayerAchievements] Schema error:",
        v.flatten(result.issues),
      );
      return null;
    }

    const achievements = result.output.achievements ?? [];
    if (!achievements.length) return null;

    return achievements.map((a) => {
      // Gamerscore sits in rewards array — find the "Gamerscore" type entry
      const gamerscoreReward = a.rewards?.find((r) => r.type === "Gamerscore");
      const gamerscore = gamerscoreReward
        ? Number(gamerscoreReward.value ?? 0)
        : 0;

      // Icon URL is also in rewards — find the "Art" type with a mediaAsset
      const iconReward = a.rewards?.find((r) => r.mediaAsset?.type === "Icon");
      const iconUrl = iconReward?.mediaAsset?.url ?? null;

      const timeUnlocked = a.progression?.timeUnlocked;
      const achieved = !!timeUnlocked && timeUnlocked !== "";
      const unlockedAt = achieved ? new Date(timeUnlocked) : null;

      return {
        apiName: a.id, // Xbox uses numeric id as the key
        name: a.name,
        description: a.description ?? null,
        isSecret: a.isSecret ?? false,
        iconUrl,
        gamerscore,
        achieved,
        unlockedAt,
        globalPercentage: a.rarity?.currentPercentage ?? null,
      };
    });
  }
}
