import {
  OAuthProviderSchema,
  type LoginInput,
  type OAuthProvider,
  type RegisterInput,
} from '@repo/shared';
import * as v from 'valibot';

import { apiClient, envelope, request } from '../api.client';

const AuthUserSchema = v.object({
  id: v.string(),
  username: v.string(),
  email: v.string(),
});

/**
 * What register/login return. The token is not in the body: the backend sets
 * it as an HttpOnly session cookie.
 */
const AuthSessionSchema = v.object({
  user: AuthUserSchema,
  created: v.boolean(),
});

export type AuthUser = v.InferOutput<typeof AuthUserSchema>;
export type AuthSession = v.InferOutput<typeof AuthSessionSchema>;

const ProvidersSchema = envelope(v.object({ providers: v.array(OAuthProviderSchema) }));
const SessionResponseSchema = envelope(AuthSessionSchema);
const UserResponseSchema = envelope(AuthUserSchema);

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
    const response = await request(ProvidersSchema, { path: '/auth/providers' });
    return response.data.providers;
  },

  /**
   * Registers an email/password account and returns the new session.
   */
  register: async (input: RegisterInput): Promise<AuthSession> => {
    const response = await request(SessionResponseSchema, {
      method: 'POST',
      path: '/auth/register',
      body: input,
    });
    return response.data;
  },

  /**
   * Signs in with email/password and returns the new session.
   */
  loginWithPassword: async (input: LoginInput): Promise<AuthSession> => {
    const response = await request(SessionResponseSchema, {
      method: 'POST',
      path: '/auth/login',
      body: input,
    });
    return response.data;
  },

  /**
   * Fetches the current session user. Returns `null` when the token is
   * missing, expired, or otherwise rejected.
   */
  me: async (): Promise<AuthUser | null> => {
    try {
      const response = await request(UserResponseSchema, { path: '/auth/me' });
      return response.data;
    } catch {
      return null;
    }
  },
};
