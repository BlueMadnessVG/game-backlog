import type { OAuthProvider } from "@repo/shared";

/**
 * Normalized profile returned by every OAuth provider, shaped so AuthService
 * can upsert a user + oauth_accounts row without caring which provider signed
 * in.
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Contract implemented by each OAuth provider wrapper (Google, Discord).
 */
export interface OAuthProviderClient {
  /**
   * Builds the provider authorize URL, returning the freshly generated
   * state + PKCE code verifier so the caller can store them until the
   * callback arrives.
   */
  createAuthorizationUrl(): Promise<{
    url: URL;
    state: string;
    codeVerifier: string;
  }>;

  /**
   * Exchanges the authorization code for tokens and resolves the provider
   * profile.
   *
   * @throws {Error} On token-exchange or profile-fetch failure.
   */
  validateAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<OAuthProfile>;
}
