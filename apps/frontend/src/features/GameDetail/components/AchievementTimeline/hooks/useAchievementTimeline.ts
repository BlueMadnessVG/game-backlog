import { useState } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutateFunction,
} from '@tanstack/react-query';

import type {
  Achievement,
  AchievementFilter,
  AchievementsResponse,
  AchievementSort,
} from '@repo/shared';

import { steamService } from '@/api/steam/steam.service';

const LIMIT = 50;

interface UseAchievementTimelineOptions {
  gameId: string;
}

interface UseAchievementTimelineReturn {
  // Data
  achievements: Achievement[];
  filtered: Achievement[];
  total: number;
  unlocked: number;

  // Pagination
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;

  // UI state
  filter: AchievementFilter;
  sort: AchievementSort;
  setFilter: (filter: AchievementFilter) => void;
  setSort: (sort: AchievementSort) => void;

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;

  // Actions
  sync: UseMutateFunction<AchievementsResponse, Error, void, unknown>;
}

function applyFilter(achievements: Achievement[], filter: AchievementFilter): Achievement[] {
  if (filter === 'unlocked') return achievements.filter((a) => a.achieved);
  if (filter === 'locked') return achievements.filter((a) => !a.achieved);
  return achievements;
}

function applySort(achievements: Achievement[], sort: AchievementSort): Achievement[] {
  return [...achievements].sort((a, b) => {
    if (sort === 'unlock-date') {
      if (!a.unlockedAt && !b.unlockedAt) return 0;
      if (!a.unlockedAt) return 1;
      if (!b.unlockedAt) return -1;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    }

    if (sort === 'name') {
      return a.name.localeCompare(b.name);
    }

    if (sort === 'rarity') {
      if (a.globalPercentage === null && b.globalPercentage === null) return 0;
      if (a.globalPercentage === null) return 1;
      if (b.globalPercentage === null) return -1;
      return a.globalPercentage - b.globalPercentage;
    }

    return 0;
  });
}

export function useAchievementTimeline({
  gameId,
}: UseAchievementTimelineOptions): UseAchievementTimelineReturn {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [sort, setSort] = useState<AchievementSort>('unlock-date');

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<
    AchievementsResponse,
    Error,
    InfiniteData<AchievementsResponse>,
    string[],
    number
  >({
    queryKey: ['achievements', gameId],
    queryFn: ({ signal, pageParam }) =>
      steamService.getAchievements(gameId, { limit: LIMIT, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage): number | undefined => {
      const { total, limit, offset } = lastPage.meta;
      const nextOffset = offset + limit;
      return nextOffset < total ? nextOffset : undefined;
    },
    enabled: !!gameId,
  });

  const { mutate: sync, isPending: isSyncing } = useMutation({
    mutationFn: () => steamService.syncAchievements(gameId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['achievements', gameId],
      });
    },
  });

  const achievements = data?.pages.flatMap((page) => page.data) ?? [];

  const total = data?.pages[0]?.meta.total ?? 0;
  const unlocked = data?.pages[0]?.meta.unlocked ?? 0;

  const filtered = applySort(applyFilter(achievements, filter), sort);

  return {
    achievements,
    filtered,
    total,
    unlocked,

    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    fetchNextPage,

    filter,
    sort,
    setFilter,
    setSort,

    isLoading,
    isSyncing,
    sync,
  };
}
