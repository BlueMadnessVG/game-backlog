import * as v from "valibot";
import {
  TwitchTokenSchema,
  IgdbGamesResponseSchema,
} from "./schemas/igdb.schemas";

export class IgdbProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://api.igdb.com/v4";
  private readonly tokenUrl = "https://id.twitch.tv/oauth2/token";

  // IGDB is a Twitch product — the app token lasts ~60 days,
  // so we cache it in memory rather than re-fetching per request.
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) {
      throw new Error("IGDB_CLIENT_ID / IGDB_CLIENT_SECRET is missing");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    // Reuse the cached token until 5 minutes before it expires
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

  private normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, " ");
  }

  private nameSimilarity(searchTitle: string, returnedName: string): number {
    const a = this.normalize(searchTitle);
    const b = this.normalize(returnedName);

    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;

    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    const setB = new Set(wordsB);
    const common = wordsA.filter((w) => setB.has(w)).length;
    if (common === 0) return 0;

    return common / Math.max(wordsA.length, wordsB.length);
  }

  private static readonly EXCLUDED_CATEGORIES = new Set<number>([
    1, 2, 3, 5, 6, 7, 13,
  ]);

  // Searches IGDB by title and returns a portrait cover URL (t_cover_large,
  // ~680x1000, ~2:3 ratio — matches Steam's 600x900 ratio closely).
  // Returns null on no match, no cover, or rate limit — caller decides fallback.
  async searchGameCover(title: string): Promise<string | null> {
    try {
      const headers = await this.headers();

      // Fetch top 5 results, exclude DLC/expansions/bundles,
      // then score remaining by name similarity
      const query = [
        `search "${title.replace(/"/g, '\\"')}";`,
        "fields name,cover.image_id,category;",
        "limit 5;",
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

      if (!result.success || result.output.length === 0) return null;

      const scored = result.output
        .filter((g) => !IgdbProvider.EXCLUDED_CATEGORIES.has(g.category))
        .map((g) => ({
          game: g,
          score: this.nameSimilarity(title, g.name),
        }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (!best || best.score < 0.5) {
        console.warn(
          `[IgdbProvider] No good match for "${title}" (best: ${best?.game.name ?? "none"}, score: ${best?.score ?? 0})`,
        );
        return null;
      }

      if (!best.game.cover?.image_id) return null;

      // t_cover_large = ~680x1000 — matches Steam's 600x900 ratio (~2:3)
      return `https://images.igdb.com/igdb/image/upload/t_cover_large/${best.game.cover.image_id}.jpg`;
    } catch (error) {
      console.error(
        `[IgdbProvider][searchGameCover] Failed for "${title}":`,
        error,
      );
      return null;
    }
  }
}
