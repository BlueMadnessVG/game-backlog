import { type GamesResponse } from '@repo/shared';

import { apiClient } from '../api.client.';

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

interface GamesParams {
  limit?: number;
  offset?: number;
}

export const steamService = {
  getGames: async (params?: GamesParams, signal?: AbortSignal): Promise<GamesResponse> => {
    const { data } = await apiClient.get<GamesResponse>('/steam/games', {
      signal,
      params: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
    });

    return data;
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
