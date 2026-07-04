import * as v from "valibot";
import {
  TwitchTokenSchema,
  IgdbGamesResponseSchema,
  type IgdbGame,
} from "./schemas/igdb.schemas";

const MIN_MATCH_SCORE = 0.5;
const TIE_EPSILON = 0.05;
const PARENT_LINK_PENALTY = 0.15;

export class IgdbProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://api.igdb.com/v4";
  private readonly tokenUrl = "https://id.twitch.tv/oauth2/token";

  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) {
      throw new Error("IGDB_CLIENT_ID / IGDB_CLIENT_SECRET is missing");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      Date.now() < this.cachedToken.expiresAt - 5 * 60_000
    ) {
      return this.cachedToken.accessToken;
    }

    const url = new URL(this.tokenUrl);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("client_secret", this.clientSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const response = await fetch(url.toString(), { method: "POST" });

    if (!response.ok) {
      throw new Error(
        `[IgdbProvider] Twitch token exchange failed: ${response.statusText}`,
      );
    }

    const rawData = await response.json();
    const result = v.safeParse(TwitchTokenSchema, rawData);

    if (!result.success) {
      throw new Error("[IgdbProvider] Unexpected Twitch token response format");
    }

    this.cachedToken = {
      accessToken: result.output.access_token,
      expiresAt: Date.now() + result.output.expires_in * 1000,
    };

    return this.cachedToken.accessToken;
  }

  private async headers() {
    const token = await this.getAccessToken();
    return {
      "Client-ID": this.clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    };
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/[™®©]/g, "")
      .replace(/[''']/g, "'")
      .replace(/\s*\(Game Preview\)\s*/gi, "")
      .replace(/\s+Trophies\s*$/i, "")
      .replace(/\s+for\s+(android|ios)\s*$/i, "")
      .replace(
        /\s+(digital\s+)?(deluxe|goty|game of the year|standard|ultimate|complete|definitive)\s+edition\s*$/i,
        "",
      )
      .replace(/\s+beta\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, " ");
  }

  private nameSimilarity(searchTitle: string, returnedName: string): number {
    const a = this.normalize(searchTitle);
    const b = this.normalize(returnedName);

    if (a === b) return 1;

    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);

    const common = wordsA.filter((w) => setB.has(w)).length;
    if (common === 0) return 0;

    const smaller = Math.min(setA.size, setB.size);
    return common / smaller;
  }

  private static readonly EXCLUDED_CATEGORIES = new Set<number>([
    1, 2, 3, 5, 6, 7, 13,
  ]);

  private isLikelyBaseGame(g: IgdbGame): boolean {
    return !IgdbProvider.EXCLUDED_CATEGORIES.has(g.category);
  }

  private parentLinkPenalty(g: IgdbGame): number {
    return g.parent_game != null || g.version_parent != null
      ? PARENT_LINK_PENALTY
      : 0;
  }

  async searchGameCover(title: string): Promise<string | null> {
    const cleanedTitle = this.cleanTitle(title);

    try {
      const headers = await this.headers();

      const query = [
        `search "${cleanedTitle.replace(/"/g, '\\"')}";`,
        "fields name,cover.image_id,category,parent_game,version_parent,total_rating_count,first_release_date;",
        "limit 10;",
      ].join(" ");

      const response = await fetch(`${this.baseUrl}/games`, {
        method: "POST",
        headers,
        body: query,
      });

      if (response.status === 429) {
        console.warn(`[IgdbProvider] Rate limit hit, skipping "${title}"`);
        return null;
      }
      if (!response.ok) {
        console.warn(
          `[IgdbProvider] Search failed for "${title}": ${response.statusText}`,
        );
        return null;
      }

      const rawData = await response.json();
      const result = v.safeParse(IgdbGamesResponseSchema, rawData);

      if (!result.success) {
        console.error(
          `[IgdbProvider] "${title}" (cleaned: "${cleanedTitle}"): schema validation FAILED`,
          JSON.stringify(result.issues, null, 2),
          "raw response sample:",
          JSON.stringify(rawData).slice(0, 500),
        );
        return null;
      }

      if (result.output.length === 0) {
        console.debug(
          `[IgdbProvider] "${title}" (cleaned: "${cleanedTitle}"): IGDB returned 0 results`,
        );
        return null;
      }

      console.debug(
        `[IgdbProvider] "${title}" (cleaned: "${cleanedTitle}") candidates:`,
        result.output.map((g) => ({
          name: g.name,
          category: g.category,
          hasParentLink: g.parent_game != null || g.version_parent != null,
          rawScore: this.nameSimilarity(cleanedTitle, g.name),
        })),
      );

      const scored = result.output
        .filter((g) => this.isLikelyBaseGame(g))
        .map((g) => ({
          game: g,
          score:
            this.nameSimilarity(cleanedTitle, g.name) -
            this.parentLinkPenalty(g),
        }))
        .filter((c) => c.score >= MIN_MATCH_SCORE)
        .sort((a, b) => {
          if (Math.abs(a.score - b.score) > TIE_EPSILON)
            return b.score - a.score;
          const ratingDiff =
            (b.game.total_rating_count ?? 0) - (a.game.total_rating_count ?? 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (
            (a.game.first_release_date ?? Infinity) -
            (b.game.first_release_date ?? Infinity)
          );
        });

      const best = scored[0];
      const runnerUp = scored[1];

      if (!best) {
        console.warn(
          `[IgdbProvider] No good match for "${title}" (cleaned: "${cleanedTitle}") — ${result.output.length} raw candidates, none passed filters (min score: ${MIN_MATCH_SCORE})`,
        );
        return null;
      }

      if (runnerUp && best.score - runnerUp.score < TIE_EPSILON * 2) {
        console.warn(
          `[IgdbProvider] Ambiguous match for "${title}": ` +
            `"${best.game.name}" (${best.score.toFixed(2)}) vs ` +
            `"${runnerUp.game.name}" (${runnerUp.score.toFixed(2)})`,
        );
      }

      if (!best.game.cover?.image_id) {
        console.debug(
          `[IgdbProvider] "${title}" matched "${best.game.name}" but it has no cover image`,
        );
        return null;
      }

      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${best.game.cover.image_id}.jpg`;
    } catch (error) {
      console.error(
        `[IgdbProvider][searchGameCover] Failed for "${title}":`,
        error,
      );
      return null;
    }
  }
}
