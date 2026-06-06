import { create } from 'zustand';

import type { Achievement } from '@repo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementCacheEntry {
  achievements: Achievement[];
  total: number;
  unlocked: number;
  fetchedAt: number;
}

interface AchievementCacheState {
  cache: Record<string, AchievementCacheEntry>;
  setCache: (gameId: string, entry: AchievementCacheEntry) => void;
  getCache: (gameId: string) => AchievementCacheEntry | undefined;
  hasCache: (gameId: string) => boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAchievementCache = create<AchievementCacheState>((set, get) => ({
  cache: {},

  setCache: (gameId, entry) =>
    set((state) => ({
      cache: { ...state.cache, [gameId]: entry },
    })),

  getCache: (gameId) => get().cache[gameId],

  hasCache: (gameId) => gameId in get().cache,
}));
