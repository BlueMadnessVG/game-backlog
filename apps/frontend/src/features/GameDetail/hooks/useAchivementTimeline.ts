import { useMemo, useState } from 'react';


import type { MessageResponse } from '@/api/api.client';
import type { Achievement, AchievementFilter, AchievementSort } from '@repo/shared';
import type { UseMutateFunction } from '@tanstack/react-query';

import { useGameAchievements, useSyncAchievements } from '@/api/library/library.queries';

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
  isSyncing: boolean;

  sync: UseMutateFunction<MessageResponse, Error, void, unknown>;
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

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Achievement data from the library queries, plus the view's filter/sort state. */
export function useAchievementTimeline({
  gameId,
}: UseAchievementTimelineOptions): UseAchievementTimelineReturn {
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [sort, setSort] = useState<AchievementSort>('unlock-date');

  const { achievements, total, unlocked, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGameAchievements(gameId);
  const { sync, isSyncing } = useSyncAchievements(gameId);

  const filtered = useMemo(
    () => applyFilterAndSort(achievements, filter, sort),
    [achievements, filter, sort],
  );

  return {
    achievements,
    filtered,
    total,
    unlocked,

    hasNextPage,
    isFetchingNextPage,
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
