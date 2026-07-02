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

  // Searches IGDB by title and returns a consistent portrait cover URL
  // (264x374, ~2:3 ratio — matches Steam's own 600x900 ratio closely).
  // Returns null on no match, no cover, or rate limit — caller decides fallback.
  async searchGameCover(title: string): Promise<string | null> {
    try {
      const headers = await this.headers();

      // Apicalypse query language — request only name + cover.image_id
      const query = `search "${title.replace(/"/g, '\\"')}"; fields name,cover.image_id; limit 1;`;

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

      const match = result.output[0];
      if (!match!.cover?.image_id) return null;

      // t_cover_big = 264x374 — the standard portrait cover size IGDB serves
      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${match!.cover.image_id}.jpg`;
    } catch (error) {
      console.error(
        `[IgdbProvider][searchGameCover] Failed for "${title}":`,
        error,
      );
      return null;
    }
  }
}
