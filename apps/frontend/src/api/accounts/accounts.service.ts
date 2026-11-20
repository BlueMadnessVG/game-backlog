import { LinkedAccountsSchema, type LinkedAccounts, type PlatformRoute } from '@repo/shared';

import { envelope, MessageResponseSchema, request, type MessageResponse } from '../api.client';

const LinkedAccountsResponseSchema = envelope(LinkedAccountsSchema);

/**
 * The user's linked platform accounts. Linking itself is
 * `platformsService.sync` (`POST /{platform}/sync`), which also imports games.
 */
export const accountsService = {
  /** `GET /accounts` — each platform's linked account, or `null`. */
  async getLinked(signal?: AbortSignal): Promise<LinkedAccounts> {
    const response = await request(LinkedAccountsResponseSchema, { path: '/accounts', signal });
    return response.data;
  },

  /** `DELETE /accounts/:platform` — imported games stay in the library. */
  unlink(platform: PlatformRoute): Promise<MessageResponse> {
    return request(MessageResponseSchema, {
      method: 'DELETE',
      path: `/accounts/${platform}`,
    });
  },
};
