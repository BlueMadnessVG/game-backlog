import { useMemo, type ReactNode } from 'react';

import { LibraryContext } from './types/LibraryContext.types';

import type { Game } from '@repo/shared';

import { steamService } from '@/api/steam/steam.service';
import { useAPI } from '@/common/hooks/useAPI/useAPI';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const {
    data: games,
    isLoading,
    refetch,
  } = useAPI<Game[], void>(steamService.getGames, undefined);

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
