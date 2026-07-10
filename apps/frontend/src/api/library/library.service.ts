import {
  GamesResponseSchema,
  StatsResponseSchema,
  type GamesResponse,
  type StatsResponse,
} from '@repo/shared';
import { flatten, safeParse } from 'valibot';

import { apiClient } from '../api.client';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIBRARY_GAMES_ENDPOINT = '/library/games';
const LIBRARY_STATS_ENDPOINT = '/library/stats';

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

// ── Errors ────────────────────────────────────────────────────────────────────

export class LibraryStatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryStatsError';
  }
}

export class LibraryGamesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryGamesError';
  }
}

// ── Pure Helpers ──────────────────────────────────────────────────────────────

function parseStatsResponse(rawData: unknown): StatsResponse {
  const result = safeParse(StatsResponseSchema, rawData);

  if (!result.success) {
    throw new LibraryStatsError('Stats response does not match the expected shape.');
  }

  if (result.output.status !== 'SUCCESS') {
    throw new LibraryStatsError(`Stats request failed with status "${result.output.status}".`);
  }

  return result.output;
}

function parseGamesResponse(rawData: unknown): GamesResponse {
  const result = safeParse(GamesResponseSchema, rawData);

  if (!result.success) {
    console.error(
      '[GamesResponse validation]',
      JSON.stringify(flatten(result.issues).nested, null, 2),
    ); // ✅ add this
    throw new LibraryGamesError('Games response does not match the expected shape.');
  }

  if (result.output.status !== 'SUCCESS') {
    throw new LibraryGamesError(`Games request failed with status "${result.output.status}".`);
  }

  return result.output;
}

// Builds the query params object, omitting any filter field the caller
// didn't provide — avoids sending `id=undefined`/`title=undefined` etc.
// as literal query string values.
function buildGamesQueryParams(params?: GamesParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };

  if (params?.id) query.id = params.id;
  if (params?.title) query.title = params.title;
  if (params?.platform) query.platform = params.platform;
  if (params?.status) query.status = params.status;

  return query;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const libraryService = {
  async getGames(params?: GamesParams, signal?: AbortSignal): Promise<GamesResponse> {
    const { data } = await apiClient.get<unknown>(LIBRARY_GAMES_ENDPOINT, {
      signal,
      params: buildGamesQueryParams(params),
    });
    return parseGamesResponse(data);
  },

  async getStats(signal?: AbortSignal): Promise<StatsResponse> {
    const { data } = await apiClient.get<unknown>(LIBRARY_STATS_ENDPOINT, { signal });
    return parseStatsResponse(data);
  },
};
