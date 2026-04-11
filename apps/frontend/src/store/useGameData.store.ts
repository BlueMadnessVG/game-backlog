import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { Game, GameStatus } from '@/common/types/GameData.type';

interface GameDataState {
  // Data
  games: Game[];

  // UI State (Filters/Search)
  searchQuery: string;
  statusFilter: GameStatus | 'all';
  sortBy: 'title' | 'playTime' | 'rating' | 'recent';
}

interface GameDataActions {
  actions: {
    // Actions
    setGames: (games: Game[]) => void;
    setSearchQuery: (query: string) => void;
    setStatusFilter: (status: GameStatus | 'all') => void;
    setSortBy: (sort: GameDataState['sortBy']) => void;

    // Computed (Logic handled outside or via selectors)
    updateGameStatus: (gameId: string, status: GameStatus) => void;
    resetFilters: () => void;
  };
}

const initialState: GameDataState = {
  // Initial State
  games: [],
  searchQuery: '',
  statusFilter: 'all',
  sortBy: 'recent',
};

export const useGameDataStore = create<GameDataState & GameDataActions>()(
  devtools(
    (set) => ({
      ...initialState,

      actions: {
        setGames: (games) => set({ games }),

        setSearchQuery: (searchQuery) => set({ searchQuery }),

        setStatusFilter: (statusFilter) => set({ statusFilter }),

        setSortBy: (sortBy) => set({ sortBy }),

        updateGameStatus: (gameId, status) =>
          set(
            (state) => ({
              games: state.games.map((g) => (g.id === gameId ? { ...g, status } : g)),
            }),
            false,
            'games/updateStatus', // Devtools action name
          ),
        resetFilters: () =>
          set({ searchQuery: '', statusFilter: 'all', sortBy: 'recent' }, false, 'filters/reset'),
      },
    }),
    {
      name: 'game-data-store',
    },
  ),
);

export const useGameDataActions = () => useGameDataStore((state) => state.actions);
