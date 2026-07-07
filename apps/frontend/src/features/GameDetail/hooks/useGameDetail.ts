import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Game } from '@repo/shared';

import { libraryService } from '@/api/library/library.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseGameDetailOptions {
  gameId: string;
}

interface UseGameDetailReturn {
  game: Game | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameDetail({ gameId }: UseGameDetailOptions): UseGameDetailReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async ({ signal }) => {
      const response = await libraryService.getGames({ id: gameId }, signal);
      return response.data[0];
    },
    enabled: !!gameId,
  });

  return {
    game: data,
    isLoading,
    isError,
    error,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    refetch,
    queryClient,
  };
}
