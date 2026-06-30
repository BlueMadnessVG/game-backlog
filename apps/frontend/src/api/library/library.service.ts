import { StatsResponseSchema, type StatsResponse } from '@repo/shared';
import { safeParse } from 'valibot';

// Adjust this import to match whatever axios instance `steamService` uses in your codebase.
import { apiClient } from '../api.client';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIBRARY_STATS_ENDPOINT = '/library/stats';

// ── Errors ────────────────────────────────────────────────────────────────────

export class LibraryStatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryStatsError';
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

// ── Service ───────────────────────────────────────────────────────────────────

export const libraryService = {
  async getStats(signal?: AbortSignal): Promise<StatsResponse> {
    const { data } = await apiClient.get<unknown>(LIBRARY_STATS_ENDPOINT, { signal });
    return parseStatsResponse(data);
  },
};
