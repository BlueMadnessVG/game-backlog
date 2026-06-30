import { useCallback, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import type { PlatformStats, Stats, StatsResponse } from '@repo/shared';

import { libraryService } from '@/api/library/library.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIBRARY_STATS_QUERY_KEY = ['library-stats'] as const;
const LIBRARY_STATS_STALE_TIME_MS = 5 * 60 * 1000;

const EMPTY_PLATFORM_STATS: PlatformStats = {
  games: 0,
  completionPercentage: 0,
  completedGames: 0,
  achievements: 0,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Breakdown = Stats['breakdown'];

export type Platform = keyof Breakdown;

interface UseLibraryStatsReturn {
  total: PlatformStats;
  breakdown: Breakdown | undefined;
  platforms: Platform[];
  remainingGames: number;

  getPlatformStats: (platform: Platform) => PlatformStats;

  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ── Pure Helpers ──────────────────────────────────────────────────────────────

function resolveTotalStats(response: StatsResponse | undefined): PlatformStats {
  if (!response) return EMPTY_PLATFORM_STATS;
  return response.data.total;
}

function resolveBreakdown(response: StatsResponse | undefined): Breakdown | undefined {
  return response?.data.breakdown;
}

function resolvePlatformStats(breakdown: Breakdown | undefined, platform: Platform): PlatformStats {
  if (!breakdown) return EMPTY_PLATFORM_STATS;
  return breakdown[platform] ?? EMPTY_PLATFORM_STATS;
}

function calculateRemainingGames(total: PlatformStats): number {
  return Math.max(total.games - total.completedGames, 0);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLibraryStats(): UseLibraryStatsReturn {
  const { data, isLoading, isError, error, refetch } = useQuery<StatsResponse, Error>({
    queryKey: LIBRARY_STATS_QUERY_KEY,
    queryFn: ({ signal }) => libraryService.getStats(signal),
    staleTime: LIBRARY_STATS_STALE_TIME_MS,
  });

  const total = useMemo(() => resolveTotalStats(data), [data]);
  const breakdown = useMemo(() => resolveBreakdown(data), [data]);
  const remainingGames = useMemo(() => calculateRemainingGames(total), [total]);

  const platforms = useMemo<Platform[]>(
    () => (breakdown ? (Object.keys(breakdown) as Platform[]) : []),
    [breakdown],
  );

  const getPlatformStats = useCallback(
    (platform: Platform): PlatformStats => resolvePlatformStats(breakdown, platform),
    [breakdown],
  );

  return {
    total,
    breakdown,
    platforms,
    remainingGames,
    getPlatformStats,

    isLoading,
    isError,
    error,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    refetch,
  };
}
