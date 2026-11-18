import { useMemo } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type InfiniteData,
  type UseMutateFunction,
} from '@tanstack/react-query';

import { libraryService, type AchievementSyncResult } from './library.service';
import { flattenPages, nextOffset } from '../queryClient/offsetPaging';

import type {
  Achievement,
  AchievementFilter,
  AchievementSort,
  AchievementsResponse,
  Game,
  GamesResponse,
  PlatformStats,
} from '@repo/shared';


// ── Keys ──────────────────────────────────────────────────────────────────────

/**
 * One key tree for everything library-shaped, so related data can be
 * refreshed together — e.g. `invalidateQueries({ queryKey: libraryKeys.all })`.
 */
export const libraryKeys = {
  all: ['library'] as const,
  games: () => [...libraryKeys.all, 'games'] as const,
  stats: () => [...libraryKeys.all, 'stats'] as const,
  game: (id: string) => [...libraryKeys.all, 'game', id] as const,
  /** Prefix for every filter/sort variant of one game's achievements. */
  achievements: (id: string) => [...libraryKeys.all, 'achievements', id] as const,
  achievementList: (id: string, filter: AchievementFilter, sort: AchievementSort) =>
    [...libraryKeys.achievements(id), filter, sort] as const,
  achievementSummary: (id: string) => [...libraryKeys.achievements(id), 'summary'] as const,
};

const PAGE_SIZE = 50;

const EMPTY_PLATFORM_STATS: PlatformStats = {
  games: 0,
  completionPercentage: 0,
  completedGames: 0,
  achievements: 0,
};

// ── Games ─────────────────────────────────────────────────────────────────────

interface UseLibraryGamesReturn {
  games: Game[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

export function useLibraryGames(): UseLibraryGamesReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<
    GamesResponse,
    Error,
    InfiniteData<GamesResponse>,
    ReturnType<typeof libraryKeys.games>,
    number
  >({
    queryKey: libraryKeys.games(),
    queryFn: ({ signal, pageParam }) =>
      libraryService.getGames({ limit: PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });

  const games = useMemo(() => flattenPages(data), [data]);

  return {
    games,
    isLoading,
    isError,
    error,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    refetch,
    isFetchingNextPage,
    hasNextPage,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    fetchNextPage,
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

interface UseLibraryStatsReturn {
  total: PlatformStats;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLibraryStats(): UseLibraryStatsReturn {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: libraryKeys.stats(),
    queryFn: ({ signal }) => libraryService.getStats(signal),
  });

  return {
    total: data?.data.total ?? EMPTY_PLATFORM_STATS,
    isLoading,
    isError,
    error,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    refetch,
  };
}

// ── Single game ───────────────────────────────────────────────────────────────

interface UseGameReturn {
  game: Game | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * One game, read through `GET /library/games?id=`. The per-platform detail
 * route (`GET /{steam|xbox|psn}/games/:id`) needs the platform up front, which
 * a bare id from the URL doesn't carry.
 */
export function useGame(id: string): UseGameReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: libraryKeys.game(id),
    queryFn: async ({ signal }) => {
      const response = await libraryService.getGames({ id }, signal);
      return response.data[0] ?? null;
    },
    enabled: !!id,
  });

  return { game: data ?? undefined, isLoading, isError, error };
}

// ── Achievements ──────────────────────────────────────────────────────────────

interface UseGameAchievementsReturn {
  achievements: Achievement[];
  total: number;
  unlocked: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

interface UseGameAchievementsOptions {
  filter?: AchievementFilter;
  sort?: AchievementSort;
}

/** One game's achievements, filtered and sorted by the backend. */
export function useGameAchievements(
  id: string,
  { filter = 'all', sort = 'rarity' }: UseGameAchievementsOptions = {},
): UseGameAchievementsReturn {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<
    AchievementsResponse,
    Error,
    InfiniteData<AchievementsResponse>,
    ReturnType<typeof libraryKeys.achievementList>,
    number
  >({
    queryKey: libraryKeys.achievementList(id, filter, sort),
    queryFn: ({ signal, pageParam }) =>
      libraryService.getAchievements(
        id,
        { filter, sort, limit: PAGE_SIZE, offset: pageParam },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled: !!id,
    // Keep the old list on screen while a new filter/sort loads.
    placeholderData: keepPreviousData,
  });

  const achievements = useMemo(() => flattenPages(data), [data]);
  const firstMeta = data?.pages[0]?.meta;

  return {
    achievements,
    total: firstMeta?.total ?? 0,
    unlocked: firstMeta?.unlocked ?? 0,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    fetchNextPage,
  };
}

/**
 * Whole-game achievement counts. The list endpoint's `meta.total` and
 * `meta.unlocked` are computed *after* the filter, so the progress header
 * reads them from an unfiltered one-row request instead.
 */
export function useAchievementSummary(id: string): {
  total: number;
  unlocked: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: libraryKeys.achievementSummary(id),
    queryFn: ({ signal }) =>
      libraryService.getAchievements(id, { filter: 'all', limit: 1, offset: 0 }, signal),
    select: (response) => response.meta,
    enabled: !!id,
  });

  return { total: data?.total ?? 0, unlocked: data?.unlocked ?? 0, isLoading };
}

interface UseSyncAchievementsReturn {
  sync: UseMutateFunction<AchievementSyncResult, Error, void, unknown>;
  isSyncing: boolean;
}

/**
 * Re-syncs one game's achievements, then refreshes everything that depends
 * on them: the achievement list, the game's completion and the library stats.
 */
export function useSyncAchievements(id: string): UseSyncAchievementsReturn {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => libraryService.syncAchievements(id),
    meta: { errorMessage: 'No se pudieron sincronizar los logros.' },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: libraryKeys.achievements(id) }),
        queryClient.invalidateQueries({ queryKey: libraryKeys.game(id) }),
        queryClient.invalidateQueries({ queryKey: libraryKeys.stats() }),
      ]);
    },
  });

  return { sync: mutate, isSyncing: isPending };
}

// ── Covers ────────────────────────────────────────────────────────────────────

/** How long to wait before re-reading games after starting cover enrichment. */
const ENRICH_REFRESH_DELAY_MS = 15_000;

/**
 * Starts background cover-art enrichment. The backend answers immediately,
 * so the games list is refreshed once after a delay to pick up new covers.
 */
export function useEnrichCovers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => libraryService.enrichCovers(),
    onSuccess: () => {
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: libraryKeys.games() });
      }, ENRICH_REFRESH_DELAY_MS);
    },
  });
}
