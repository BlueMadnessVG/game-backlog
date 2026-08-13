import { type OAuthProvider } from '@repo/shared';

import { apiClient } from '../api.client';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

/**
 * Kicks off the OAuth dance by redirecting to the backend, which bounces the
 * browser back to `/auth/callback#token=<jwt>` on success.
 */
export const authService = {
  login: (provider: OAuthProvider): void => {
    window.location.href = `${apiClient.defaults.baseURL}/auth/${provider}`;
  },

  /**
   * Fetches the current session user. Returns `null` when the token is
   * missing, expired, or otherwise rejected.
   */
  me: async (): Promise<AuthUser | null> => {
    try {
      const { data } = await apiClient.get<{
        status: string;
        data: AuthUser;
      }>('/auth/me');
      return data.data;
    } catch {
      return null;
    }
  },
};
