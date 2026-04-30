import { useMemo, type ReactNode } from 'react';

import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { LibraryContext } from './types/LibraryContext.types';

import type { Game, GamesResponse } from '@repo/shared';

import { steamService } from '@/api/steam/steam.service';

const LIMIT = 50;

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<
    GamesResponse,
    Error,
    InfiniteData<GamesResponse>,
    string[],
    number
  >({
    queryKey: ['library', 'games'],
    queryFn: ({ signal, pageParam }): Promise<GamesResponse> =>
      steamService.getGames({ limit: LIMIT, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage: GamesResponse): number | undefined => {
      const { total, limit, offset } = lastPage.meta;
      const nextOffset = offset + limit;
      return nextOffset < total ? nextOffset : undefined;
    },
  });

  console.log({ hasNextPage, pagesLoaded: data?.pages.length, total: data?.pages[0]?.meta.total });

  const games = useMemo<Game[]>(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  const value = useMemo(
    () => ({
      games,
      isLoading,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      fetchNextPage,
    }),
    [games, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
