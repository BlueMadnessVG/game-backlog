import { useMemo } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseMutateFunction,
} from '@tanstack/react-query';

import { libraryService } from './library.service';
import { flattenPages, nextOffset } from '../queryClient/offsetPaging';

import type { MessageResponse } from '../api.client';
import type {
  Achievement,
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
  achievements: (id: string) => [...libraryKeys.all, 'achievements', id] as const,
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
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

export function useLibraryGames(): UseLibraryGamesReturn {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<
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

/** One game, read through the list endpoint's `id` filter (no detail endpoint). */
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

export function useGameAchievements(id: string): UseGameAchievementsReturn {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<
    AchievementsResponse,
    Error,
    InfiniteData<AchievementsResponse>,
    ReturnType<typeof libraryKeys.achievements>,
    number
  >({
    queryKey: libraryKeys.achievements(id),
    queryFn: ({ signal, pageParam }) =>
      libraryService.getAchievements(id, { limit: PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled: !!id,
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

interface UseSyncAchievementsReturn {
  sync: UseMutateFunction<MessageResponse, Error, void, unknown>;
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
