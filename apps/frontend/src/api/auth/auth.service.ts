import {
  AuthSessionSchema,
  MeSchema,
  ProvidersSchema,
  type AuthSession,
  type AuthUser,
  type LoginInput,
  type Me,
  type OAuthProvider,
  type RegisterInput,
} from '@repo/shared';

import { API_BASE_URL, ApiError, envelope, MessageResponseSchema, request } from '../api.client';

export type { AuthSession, AuthUser, Me };

const ProvidersResponseSchema = envelope(ProvidersSchema);
const SessionResponseSchema = envelope(AuthSessionSchema);
const MeResponseSchema = envelope(MeSchema);

export const authService = {
  /**
   * Kicks off the OAuth dance by redirecting to `GET /auth/:provider`. On
   * success the backend sets the session cookie and bounces the browser back
   * to `/auth/callback`; on failure it appends `#error=<reason>`.
   */
  login: (provider: OAuthProvider): void => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  },

  /** `GET /auth/providers` — the social providers the backend has configured. */
  providers: async (signal?: AbortSignal): Promise<OAuthProvider[]> => {
    const response = await request(ProvidersResponseSchema, { path: '/auth/providers', signal });
    return response.data.providers;
  },

  /** `POST /auth/register` — creates an email/password account and starts its session. */
  register: async (input: RegisterInput): Promise<AuthSession> => {
    const response = await request(SessionResponseSchema, {
      method: 'POST',
      path: '/auth/register',
      body: input,
    });
    return response.data;
  },

  /** `POST /auth/login` — signs in with email/password and starts a session. */
  loginWithPassword: async (input: LoginInput): Promise<AuthSession> => {
    const response = await request(SessionResponseSchema, {
      method: 'POST',
      path: '/auth/login',
      body: input,
    });
    return response.data;
  },

  /** `POST /auth/logout` — the backend clears the session cookie. */
  logout: async (): Promise<void> => {
    await request(MessageResponseSchema, { method: 'POST', path: '/auth/logout' });
  },

  /**
   * `GET /auth/me` — the current session user, or `null` when there is no
   * valid session (401). Any other failure (network, 5xx, bad shape) is
   * rethrown so an outage isn't mistaken for being signed out.
   */
  me: async (): Promise<Me | null> => {
    try {
      const response = await request(MeResponseSchema, { path: '/auth/me' });
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
};
