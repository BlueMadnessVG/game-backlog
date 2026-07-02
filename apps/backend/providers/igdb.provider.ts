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

  // Removes trademark symbols and collapses whitespace — "Modern Warfare®"
  // and "EA Sports™ FIFA Street" search poorly on IGDB with these intact.
  private sanitizeTitle(title: string): string {
    return title.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
  }

  // Strips edition suffixes and parenthetical platform tags —
  // "Diablo IV (Xbox Series X)" or "Skyrim - Special Edition" often
  // fail to match while the base title succeeds.
  private stripEditionSuffix(title: string): string {
    return title
      .replace(/\s*\([^)]*\)/g, "")
      .replace(
        /\s*[-–—]\s*(Game of the Year|GOTY|Deluxe|Definitive|Ultimate|Remastered|Complete|Standard)\s*(Edition)?$/i,
        "",
      )
      .trim();
  }

  private async queryIgdb(title: string): Promise<string | null> {
    const headers = await this.headers();
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

    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${match!.cover.image_id}.jpg`;
  }

  // Tries the sanitized title first, then a stripped-down variant
  // (no edition suffix, no parenthetical tags) if the first attempt misses.
  // Returns null if neither matches — some titles (dashboard apps, obscure
  // Xbox 360 utilities) genuinely have no IGDB entry, and that's expected.
  async searchGameCover(title: string): Promise<string | null> {
    try {
      const sanitized = this.sanitizeTitle(title);

      const firstAttempt = await this.queryIgdb(sanitized);
      if (firstAttempt) return firstAttempt;

      const stripped = this.stripEditionSuffix(sanitized);
      if (stripped !== sanitized && stripped.length > 0) {
        const secondAttempt = await this.queryIgdb(stripped);
        if (secondAttempt) return secondAttempt;
      }

      return null;
    } catch (error) {
      console.error(
        `[IgdbProvider][searchGameCover] Failed for "${title}":`,
        error,
      );
      return null;
    }
  }
}
