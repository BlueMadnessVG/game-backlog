import { type LoginInput, type OAuthProvider, type RegisterInput } from '@repo/shared';

import { apiClient } from '../api.client';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  created: boolean;
}

const sessionFrom = (data: AuthSession): AuthSession => data;

/**
 * Kicks off the OAuth dance by redirecting to the backend, which bounces the
 * browser back to `/auth/callback#token=<jwt>` on success.
 */
export const authService = {
  login: (provider: OAuthProvider): void => {
    window.location.href = `${apiClient.defaults.baseURL}/auth/${provider}`;
  },

  /**
   * Lists the social providers the backend currently has configured. The UI
   * renders whichever of these it has flagged as enabled.
   */
  providers: async (): Promise<OAuthProvider[]> => {
    const { data } = await apiClient.get<{
      status: string;
      data: { providers: OAuthProvider[] };
    }>('/auth/providers');
    return data.data.providers;
  },

  /**
   * Registers an email/password account and returns the new session.
   */
  register: async (input: RegisterInput): Promise<AuthSession> => {
    const { data } = await apiClient.post<{
      status: string;
      data: AuthSession;
    }>('/auth/register', input);
    return sessionFrom(data.data);
  },

  /**
   * Signs in with email/password and returns the new session.
   */
  loginWithPassword: async (input: LoginInput): Promise<AuthSession> => {
    const { data } = await apiClient.post<{
      status: string;
      data: AuthSession;
    }>('/auth/login', input);
    return sessionFrom(data.data);
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
