import {
  AchievementsResponseSchema,
  type AchievementsResponse,
  type Game,
  type GamesResponse,
} from '@repo/shared';

import { apiClient, MessageResponseSchema, request, type MessageResponse } from '../api.client';

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

interface GamesParams {
  limit?: number;
  offset?: number;
}

interface AchievementParams {
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

  getGameById: async (id: string, signal?: AbortSignal): Promise<Game> => {
    const { data } = await apiClient.get<{ status: string; data: Game }>(`/steam/games/${id}`, {
      signal,
    });
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

  getAchievements: (
    gameId: string,
    params?: AchievementParams,
    signal?: AbortSignal,
  ): Promise<AchievementsResponse> =>
    request(AchievementsResponseSchema, {
      method: 'POST',
      path: `/steam/games/${gameId}/achievements`,
      query: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    }),

  syncAchievements: (gameId: string): Promise<MessageResponse> =>
    request(MessageResponseSchema, {
      method: 'POST',
      path: `/steam/games/${gameId}/sync-achievements`,
    }),
};
