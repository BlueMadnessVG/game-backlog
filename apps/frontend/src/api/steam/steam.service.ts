import { type Game } from '@repo/shared';

import { apiClient } from '../api.client.';

// 1. Define the shape of your Backend's standard envelope
interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export const steamService = {
  getGames: async (_?: void, signal?: AbortSignal): Promise<Game[]> => {
    // Pass the type to the .get method: apiClient.get<T>(...)
    const { data } = await apiClient.get<ApiResponse<Game[]>>('/steam/games', { signal });

    // Now 'data' is typed, and returning 'data.data' is safe!
    return data.data;
  },

  sync: async (steamId: string, signal?: AbortSignal): Promise<ApiResponse<unknown>> => {
    const { data } = await apiClient.post<ApiResponse<unknown>>(
      '/steam/sync',
      { steamId },
      { signal },
    );
    return data;
  },
};
