import { useQuery } from '@tanstack/react-query';

import type { CategorizedGames, GameCategory } from '../types/billboard';
import type { Game } from '@repo/shared';

import { steamService } from '@/api/steam/steam.service';

const categorizeGames = (games: readonly Game[]): CategorizedGames => {
  const playing: Game[] = [];
  const completed: Game[] = [];
  const backlog: Game[] = [];

  games.forEach((game) => {
    if (game.status === 'in-progress') {
      playing.push(game);
    } else if (game.status === 'completed') {
      completed.push(game);
    } else if (game.status === 'backlog') {
      backlog.push(game);
    }
  });

  return { playing, completed, backlog };
};

export const useGamesByCategory = (enabled = true) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['games', 'categorized'],
    queryFn: async ({ signal }) => {
      const response = await steamService.getGames({ limit: 100, offset: 0 }, signal);
      if (response.status !== 'SUCCESS' || !response.data) {
        throw new Error('Failed to fetch games');
      }
      return categorizeGames(response.data);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    games: data,
    isLoading,
    hasError: !!error,
    getGamesByCategory: (category: GameCategory) => data?.[category] ?? [],
  };
};
