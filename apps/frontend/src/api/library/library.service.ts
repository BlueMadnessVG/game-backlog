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

interface GamesParams {
  limit?: number;
  offset?: number;
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

// ── Service ───────────────────────────────────────────────────────────────────

export const libraryService = {
  async getGames(params?: GamesParams, signal?: AbortSignal): Promise<GamesResponse> {
    const { data } = await apiClient.get<unknown>(LIBRARY_GAMES_ENDPOINT, {
      signal,
      params: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
    });
    return parseGamesResponse(data);
  },

  async getStats(signal?: AbortSignal): Promise<StatsResponse> {
    const { data } = await apiClient.get<unknown>(LIBRARY_STATS_ENDPOINT, { signal });
    return parseStatsResponse(data);
  },
};
