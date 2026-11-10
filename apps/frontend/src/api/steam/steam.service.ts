import { AchievementsResponseSchema, type AchievementsResponse } from '@repo/shared';

import { MessageResponseSchema, request, type MessageResponse } from '../api.client';

interface AchievementParams {
  limit?: number;
  offset?: number;
}

export const steamService = {
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
