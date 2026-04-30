import { createContext } from 'react';

import type { Game } from '@repo/shared';
import type { FetchNextPageOptions } from '@tanstack/react-query';

export interface LibraryContextType {
  games: Game[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => void;
}

export const LibraryContext = createContext<LibraryContextType | undefined>(undefined);
