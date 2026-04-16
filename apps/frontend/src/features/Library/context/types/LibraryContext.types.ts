import { createContext } from 'react';

import type { Game } from '@repo/shared';

export interface LibraryContextType {
  games: Game[] | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export const LibraryContext = createContext<LibraryContextType | undefined>(undefined);
