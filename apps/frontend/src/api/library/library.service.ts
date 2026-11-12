import {
  AchievementsResponseSchema,
  GamesResponseSchema,
  StatsResponseSchema,
  type AchievementsResponse,
  type GamesResponse,
  type StatsResponse,
} from '@repo/shared';

import { MessageResponseSchema, request, type MessageResponse } from '../api.client';

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePlatform = 'steam' | 'xbox' | 'playstation';
type GameStatus = 'backlog' | 'in-progress' | 'completed' | 'retired';

interface PageParams {
  limit?: number;
  offset?: number;
}

interface GamesParams extends PageParams {
  // Filter fields — combine any of these. Mirrors GameLibraryFilter on the
  // backend: id/status are exact match, title is a case-insensitive
  // partial match, platform (if set) restricts which platform is queried.
  id?: string;
  title?: string;
  platform?: GamePlatform;
  status?: GameStatus;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const libraryService = {
  getGames(params?: GamesParams, signal?: AbortSignal): Promise<GamesResponse> {
    return request(GamesResponseSchema, {
      path: '/library/games',
      query: { ...params, limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },

  getStats(signal?: AbortSignal): Promise<StatsResponse> {
    return request(StatsResponseSchema, { path: '/library/stats', signal });
  },

  /**
   * Achievements for one game. The backend resolves the platform (Steam,
   * Xbox, PSN) from the game itself.
   */
  getAchievements(
    gameId: string,
    params?: PageParams,
    signal?: AbortSignal,
  ): Promise<AchievementsResponse> {
    return request(AchievementsResponseSchema, {
      path: `/library/games/${gameId}/achievements`,
      query: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },

  /** Forces a fresh achievement sync for one game, on whichever platform it's on. */
  syncAchievements(gameId: string): Promise<MessageResponse> {
    return request(MessageResponseSchema, {
      method: 'POST',
      path: `/library/games/${gameId}/achievements/sync`,
    });
  },
};
