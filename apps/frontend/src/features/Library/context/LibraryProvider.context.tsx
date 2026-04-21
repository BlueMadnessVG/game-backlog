import { useMemo, type ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import { LibraryContext } from './types/LibraryContext.types';

import type { Game } from '@repo/shared';

import { steamService } from '@/api/steam/steam.service';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const {
    data: games,
    isLoading,
    refetch,
  } = useQuery<Game[]>({
    queryKey: ['library', 'games'],
    queryFn: ({ signal }) => steamService.getGames(undefined, signal),
  });

  const value = useMemo(
    () => ({
      games,
      isLoading,
      refetch,
    }),
    [games, isLoading, refetch],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
