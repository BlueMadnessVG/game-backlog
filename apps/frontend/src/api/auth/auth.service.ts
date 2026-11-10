import {
  OAuthProviderSchema,
  type LoginInput,
  type OAuthProvider,
  type RegisterInput,
} from '@repo/shared';
import * as v from 'valibot';

import { API_BASE_URL, envelope, MessageResponseSchema, request } from '../api.client';

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
 * Kicks off the OAuth dance by redirecting to the backend. On success it sets
 * the session cookie and bounces the browser back to `/auth/callback`; on
 * failure it appends `#error=<reason>`.
 */
export const authService = {
  login: (provider: OAuthProvider): void => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
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
   * Ends the session: the backend clears the cookie.
   */
  logout: async (): Promise<void> => {
    await request(MessageResponseSchema, { method: 'POST', path: '/auth/logout' });
  },

  /**
   * Fetches the current session user. Returns `null` when there is no valid
   * session cookie.
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
