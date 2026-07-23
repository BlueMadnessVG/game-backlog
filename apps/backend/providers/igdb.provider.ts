import * as v from "valibot";
import {
  TwitchTokenSchema,
  IgdbGamesResponseSchema,
  type IgdbGame,
} from "./schemas/igdb.schemas";

const MIN_MATCH_SCORE = 0.5;
const TIE_EPSILON = 0.05;
const PARENT_LINK_PENALTY = 0.15;

/**
 * Provider for IGDB cover-art lookups, authenticated via the Twitch OAuth2
 * client-credentials flow.
 *
 * @remarks
 * Each instance caches the Twitch access token in memory and refreshes it
 * automatically when within five minutes of expiry. No persistent storage
 * is used — constructing a new instance resets the cache.
 *
 * The search algorithm scores candidates by word-level overlap, penalises
 * DLC / expansions via {@link IgdbProvider.EXCLUDED_CATEGORIES}, applies a
 * small penalty for games with `parent_game` or `version_parent` links,
 * and breaks ties by popularity then release date.
 *
 * @example
 * ```ts
 * const igdb = new IgdbProvider("client-id", "client-secret");
 * const coverUrl = await igdb.searchGameCover("Elden Ring");
 * // → "https://images.igdb.com/igdb/image/upload/t_cover_big/…"
 * ```
 */
export class IgdbProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://api.igdb.com/v4";
  private readonly tokenUrl = "https://id.twitch.tv/oauth2/token";

  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  /**
   * Creates a new IGDB provider.
   *
   * @param clientId - Twitch application client ID.
   * @param clientSecret - Twitch application client secret.
   * @throws {Error} When either `clientId` or `clientSecret` is falsy.
   *
   * @example
   * ```ts
   * const igdb = new IgdbProvider(
   *   process.env.IGDB_CLIENT_ID!,
   *   process.env.IGDB_CLIENT_SECRET!,
   * );
   * ```
   */
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

  /**
   * Strips trademark symbols, smart quotes, platform suffixes, and common
   * edition labels from a raw game title to improve search accuracy.
   *
   * @param title - The raw game title to clean.
   * @returns The normalised title string.
   *
   * @example
   * ```ts
   * cleanTitle("The Witcher 3: Wild Hunt – Game of the Year Edition")
   * // → "The Witcher 3: Wild Hunt"
   * ```
   */
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

  /**
   * Computes a word-overlap similarity score between two title strings.
   *
   * @returns A value between `0` (no shared words) and `1` (exact match).
   */
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

  /**
   * IGDB category IDs that represent non-base-game entries (DLC, expansions,
   * bundles, mods, etc.). Candidates whose `category` is in this set are
   * excluded from cover-art ranking.
   */
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

  /**
   * Searches IGDB for the best cover-art match of the given game title.
   *
   * @remarks
   * The search pipeline:
   * 1. Cleans the title (strips editions, trademarks, platform suffixes).
   * 2. Queries the IGDB `/games` search endpoint (up to 10 candidates).
   * 3. Filters out DLC / expansion / bundle categories.
   * 4. Scores remaining candidates by word-overlap similarity minus a
   *    small penalty for `parent_game` / `version_parent` links.
   * 5. Requires a minimum score of {@link MIN_MATCH_SCORE}.
   * 6. Breaks ties by total rating count, then earliest release date.
   * 7. Warns when the top two candidates are ambiguous.
   *
   * @param title - The game title to search for.
   * @returns The full IGDB cover-art URL, or `null` when no suitable match
   *   is found, the API returns an error, or the best candidate has no
   *   cover image.
   *
   * @example
   * ```ts
   * const igdb = new IgdbProvider("id", "secret");
   * const url = await igdb.searchGameCover("Hollow Knight");
   * if (url) {
   *   console.log(url); // https://images.igdb.com/igdb/image/upload/t_cover_big/…
   * }
   * ```
   */
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
