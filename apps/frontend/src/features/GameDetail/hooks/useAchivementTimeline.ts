import { useEffect, useState } from 'react';

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
import { useAchievementCache } from '@/store/useAchievementCache';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACHIEVEMENTS_PAGE_LIMIT = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseAchievementTimelineOptions {
  gameId: string;
}

interface UseAchievementTimelineReturn {
  achievements: Achievement[];
  filtered: Achievement[];
  total: number;
  unlocked: number;

  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;

  filter: AchievementFilter;
  sort: AchievementSort;
  setFilter: (filter: AchievementFilter) => void;
  setSort: (sort: AchievementSort) => void;

  isLoading: boolean;
  isFromCache: boolean;
  isSyncing: boolean;

  sync: UseMutateFunction<AchievementsResponse, Error, void, unknown>;
}

// ── Pure Helpers ──────────────────────────────────────────────────────────────

function filterAchievements(achievements: Achievement[], filter: AchievementFilter): Achievement[] {
  if (filter === 'unlocked') return achievements.filter((a) => a.achieved);
  if (filter === 'locked') return achievements.filter((a) => !a.achieved);
  return achievements;
}

function sortAchievements(achievements: Achievement[], sort: AchievementSort): Achievement[] {
  return [...achievements].sort((a, b) => {
    if (sort === 'unlock-date') {
      if (!a.unlockedAt && !b.unlockedAt) return 0;
      if (!a.unlockedAt) return 1;
      if (!b.unlockedAt) return -1;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    }

    if (sort === 'name') return a.name.localeCompare(b.name);

    if (sort === 'rarity') {
      if (a.globalPercentage === null && b.globalPercentage === null) return 0;
      if (a.globalPercentage === null) return 1;
      if (b.globalPercentage === null) return -1;
      return a.globalPercentage - b.globalPercentage;
    }

    return 0;
  });
}

function applyFilterAndSort(
  achievements: Achievement[],
  filter: AchievementFilter,
  sort: AchievementSort,
): Achievement[] {
  return sortAchievements(filterAchievements(achievements, filter), sort);
}

function flattenPages(data: InfiniteData<AchievementsResponse> | undefined): Achievement[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line complexity
export function useAchievementTimeline({
  gameId,
}: UseAchievementTimelineOptions): UseAchievementTimelineReturn {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [sort, setSort] = useState<AchievementSort>('unlock-date');

  const { setCache, getCache, hasCache } = useAchievementCache();

  const cachedEntry = getCache(gameId);
  const isFromCache = hasCache(gameId);

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<
    AchievementsResponse,
    Error,
    InfiniteData<AchievementsResponse>,
    string[],
    number
  >({
    queryKey: ['achievements', gameId],
    queryFn: ({ signal, pageParam }) =>
      steamService.getAchievements(
        gameId,
        { limit: ACHIEVEMENTS_PAGE_LIMIT, offset: pageParam },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage): number | undefined => {
      const { total, limit, offset } = lastPage.meta;
      const nextOffset = offset + limit;
      return nextOffset < total ? nextOffset : undefined;
    },
    enabled: !!gameId && !isFromCache,
  });

  // ── Persist fresh data into the Zustand cache ─────────────────────────────
  useEffect(() => {
    if (!data || isFromCache) return;

    const freshAchievements = flattenPages(data);
    if (freshAchievements.length === 0) return;

    setCache(gameId, {
      achievements: freshAchievements,
      total: data.pages[0]?.meta.total ?? 0,
      unlocked: data.pages[0]?.meta.unlocked ?? 0,
      fetchedAt: Date.now(),
    });
  }, [data, gameId, isFromCache, setCache]);

  const { mutate: sync, isPending: isSyncing } = useMutation({
    mutationFn: () => steamService.syncAchievements(gameId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['achievements', gameId] });
    },
  });

  // ── Resolve final data: prefer cache, fall back to live query ────────────
  const achievements = isFromCache ? (cachedEntry?.achievements ?? []) : flattenPages(data);
  const total = isFromCache ? (cachedEntry?.total ?? 0) : (data?.pages[0]?.meta.total ?? 0);
  const unlocked = isFromCache
    ? (cachedEntry?.unlocked ?? 0)
    : (data?.pages[0]?.meta.unlocked ?? 0);

  const filtered = applyFilterAndSort(achievements, filter, sort);

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

    isLoading: !isFromCache && isLoading,
    isFromCache,
    isSyncing,
    sync,
  };
}
