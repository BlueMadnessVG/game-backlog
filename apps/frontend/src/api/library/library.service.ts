import {
  AchievementSyncResultSchema,
  AchievementsResponseSchema,
  GamesResponseSchema,
  StatsResponseSchema,
  type AchievementFilter,
  type AchievementSort,
  type AchievementsResponse,
  type GameStatus,
  type GamesResponse,
  type LibraryPlatform,
  type StatsResponse,
} from '@repo/shared';

import {
  messageEnvelope,
  MessageResponseSchema,
  request,
  type MessageResponse,
} from '../api.client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageParams {
  /** Default 50; the backend caps game lists at 100. */
  limit?: number;
  offset?: number;
}

export interface GamesParams extends PageParams {
  // Filter fields — combine any of these. Mirrors GameLibraryFilter on the
  // backend: id/status are exact match, title is a case-insensitive
  // partial match, platform (if set) restricts which platform is queried.
  id?: string;
  title?: string;
  platform?: LibraryPlatform;
  status?: GameStatus;
}

export interface AchievementsParams extends PageParams {
  /** Backend default: `all`. */
  filter?: AchievementFilter;
  /** Backend default: `rarity`. */
  sort?: AchievementSort;
}

export interface AchievementSyncResult {
  synced: number;
  message: string | undefined;
}

const AchievementSyncResponseSchema = messageEnvelope(AchievementSyncResultSchema);

// ── Service ───────────────────────────────────────────────────────────────────

export const libraryService = {
  /** `GET /library/games` — newest-updated first. */
  getGames(params?: GamesParams, signal?: AbortSignal): Promise<GamesResponse> {
    return request(GamesResponseSchema, {
      path: '/library/games',
      query: { ...params, limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },

  /** `GET /library/stats` — totals plus a per-platform breakdown. */
  getStats(signal?: AbortSignal): Promise<StatsResponse> {
    return request(StatsResponseSchema, { path: '/library/stats', signal });
  },

  /**
   * `GET /library/games/:gameId/achievements` — filtered and sorted on the
   * server. The backend resolves the platform (Steam, Xbox, PSN) from the game.
   */
  getAchievements(
    gameId: string,
    params?: AchievementsParams,
    signal?: AbortSignal,
  ): Promise<AchievementsResponse> {
    return request(AchievementsResponseSchema, {
      path: `/library/games/${encodeURIComponent(gameId)}/achievements`,
      query: { ...params, limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },

  /** `POST /library/games/:gameId/achievements/sync` — forces a fresh sync on the game's platform. */
  async syncAchievements(gameId: string): Promise<AchievementSyncResult> {
    const response = await request(AchievementSyncResponseSchema, {
      method: 'POST',
      path: `/library/games/${encodeURIComponent(gameId)}/achievements/sync`,
    });
    return { synced: response.data.synced, message: response.message };
  },

  /**
   * `POST /library/enrich-covers` — starts cover-art enrichment in the
   * background and returns immediately.
   */
  enrichCovers(): Promise<MessageResponse> {
    return request(MessageResponseSchema, { method: 'POST', path: '/library/enrich-covers' });
  },
};
