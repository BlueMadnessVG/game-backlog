import { Google, generateCodeVerifier, generateState } from "arctic";

import type { OAuthProfile, OAuthProviderClient } from "./oauth.types";

const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

interface GoogleUserInfo {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
}

/**
 * Google OAuth 2.0 + OpenID Connect wrapper (arctic under the hood).
 *
 * Uses the authorization-code + PKCE flow and fetches the profile from the
 * standard `userinfo` endpoint.
 *
 * Exports:
 *  - GoogleOAuthProvider: an OAuthProviderClient implementation.
 */
export class GoogleOAuthProvider implements OAuthProviderClient {
  private readonly client: Google;

  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID is missing");
    if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is missing");
    if (!redirectURI) throw new Error("GOOGLE_REDIRECT_URI is missing");
    this.client = new Google(clientId, clientSecret, redirectURI);
  }

  async createAuthorizationUrl() {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = this.client.createAuthorizationURL(state, codeVerifier, [
      "profile",
      "email",
    ]);
    return { url, state, codeVerifier };
  }

  async validateAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<OAuthProfile> {
    const tokens = await this.client.validateAuthorizationCode(
      code,
      codeVerifier,
    );
    const user = await this.fetchUserInfo(tokens.accessToken());

    if (!user.sub) {
      throw new Error("Google userinfo response did not include sub");
    }

    return {
      provider: "google",
      providerAccountId: user.sub,
      username: user.name ?? user.email ?? "google-user",
      email: user.email ?? "",
      avatarUrl: user.picture ?? null,
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Google userinfo failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as GoogleUserInfo;
  }
}
