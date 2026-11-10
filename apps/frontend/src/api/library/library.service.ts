import {
  GamesResponseSchema,
  StatsResponseSchema,
  type GamesResponse,
  type StatsResponse,
} from '@repo/shared';

import { request } from '../api.client';

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePlatform = 'steam' | 'xbox' | 'playstation';
type GameStatus = 'backlog' | 'in-progress' | 'completed' | 'retired';

interface GamesParams {
  limit?: number;
  offset?: number;
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
};
