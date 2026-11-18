import { useMemo } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { platformsService, type PlatformSyncMap } from './platforms.service';
import { libraryKeys } from '../library/library.queries';
import { flattenPages, nextOffset } from '../queryClient/offsetPaging';

import type { GamesResponse, PlatformRoute } from '@repo/shared';

// ── Keys ──────────────────────────────────────────────────────────────────────

export const platformKeys = {
  all: ['platforms'] as const,
  platform: (platform: PlatformRoute) => [...platformKeys.all, platform] as const,
  games: (platform: PlatformRoute) => [...platformKeys.platform(platform), 'games'] as const,
  game: (platform: PlatformRoute, id: string) =>
    [...platformKeys.platform(platform), 'game', id] as const,
};

const PAGE_SIZE = 50;

// ── Queries ───────────────────────────────────────────────────────────────────

/** One platform's games, paged. Not used by a screen yet. */
export function usePlatformGames(platform: PlatformRoute) {
  const query = useInfiniteQuery<
    GamesResponse,
    Error,
    InfiniteData<GamesResponse>,
    ReturnType<typeof platformKeys.games>,
    number
  >({
    queryKey: platformKeys.games(platform),
    queryFn: ({ signal, pageParam }) =>
      platformsService.getGames(platform, { limit: PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });

  const games = useMemo(() => flattenPages(query.data), [query.data]);
  return { ...query, games };
}

/** One game through its platform's detail route. */
export function usePlatformGame(platform: PlatformRoute | null, id: string) {
  return useQuery({
    queryKey: platformKeys.game(platform ?? 'steam', id),
    queryFn: ({ signal }) => platformsService.getGame(platform!, id, signal),
    enabled: !!platform && !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Links a platform account and imports its library, then refreshes every
 * library view and that platform's cache.
 */
export function useSyncPlatform<P extends PlatformRoute>(platform: P) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlatformSyncMap[P]['input']) => platformsService.sync(platform, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: libraryKeys.all }),
        queryClient.invalidateQueries({ queryKey: platformKeys.platform(platform) }),
      ]),
  });
}

/** Re-syncs one game's achievements through its platform router. */
export function useSyncPlatformAchievements(platform: PlatformRoute, gameId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => platformsService.syncAchievements(platform, gameId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: libraryKeys.achievements(gameId) }),
        queryClient.invalidateQueries({ queryKey: libraryKeys.game(gameId) }),
        queryClient.invalidateQueries({ queryKey: libraryKeys.stats() }),
      ]),
  });
}
