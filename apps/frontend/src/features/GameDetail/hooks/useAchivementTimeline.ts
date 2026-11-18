import { useState } from 'react';

import type { AchievementSyncResult } from '@/api/library/library.service';
import type { Achievement, AchievementFilter, AchievementSort } from '@repo/shared';
import type { UseMutateFunction } from '@tanstack/react-query';

import {
  useAchievementSummary,
  useGameAchievements,
  useSyncAchievements,
} from '@/api/library/library.queries';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseAchievementTimelineOptions {
  gameId: string;
}

interface UseAchievementTimelineReturn {
  achievements: Achievement[];
  /** Same list as `achievements`: filter and sort are applied by the backend. */
  filtered: Achievement[];
  /** Whole-game counts, independent of the current filter. */
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

  sync: UseMutateFunction<AchievementSyncResult, Error, void, unknown>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Achievement data plus the view's filter/sort state. Filter and sort are sent
 * to `GET /library/games/:gameId/achievements`, so pagination stays correct:
 * sorting client-side would only reorder the pages loaded so far.
 */
export function useAchievementTimeline({
  gameId,
}: UseAchievementTimelineOptions): UseAchievementTimelineReturn {
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [sort, setSort] = useState<AchievementSort>('unlock-date');

  const { achievements, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGameAchievements(gameId, { filter, sort });
  const summary = useAchievementSummary(gameId);
  const { sync, isSyncing } = useSyncAchievements(gameId);

  return {
    achievements,
    filtered: achievements,
    total: summary.total,
    unlocked: summary.unlocked,

    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,

    filter,
    sort,
    setFilter,
    setSort,

    isLoading: isLoading || summary.isLoading,
    isSyncing,
    sync,
  };
}
