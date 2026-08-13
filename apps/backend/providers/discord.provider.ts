import { Discord, generateCodeVerifier, generateState } from "arctic";

import type { OAuthProfile, OAuthProviderClient } from "./oauth.types";

const ME_URL = "https://discord.com/api/v10/users/@me";
const AVATAR_CDN_URL = "https://cdn.discordapp.com/avatars";

interface DiscordUserInfo {
  id?: string;
  username?: string;
  global_name?: string | null;
  email?: string | null;
  avatar?: string | null;
}

/**
 * Discord OAuth 2.0 wrapper (arctic under the hood).
 *
 * Uses the authorization-code + PKCE flow (Discord supports RFC 7636) and
 * resolves the profile from the `GET /users/@me` endpoint.
 *
 * Exports:
 *  - DiscordOAuthProvider: an OAuthProviderClient implementation.
 */
export class DiscordOAuthProvider implements OAuthProviderClient {
  private readonly client: Discord;

  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    if (!clientId) throw new Error("DISCORD_CLIENT_ID is missing");
    if (!clientSecret) throw new Error("DISCORD_CLIENT_SECRET is missing");
    if (!redirectURI) throw new Error("DISCORD_REDIRECT_URI is missing");
    this.client = new Discord(clientId, clientSecret, redirectURI);
  }

  async createAuthorizationUrl() {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = this.client.createAuthorizationURL(state, codeVerifier, [
      "identify",
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
    const user = await this.fetchMe(tokens.accessToken());

    if (!user.id) {
      throw new Error("Discord /users/@me response did not include id");
    }

    return {
      provider: "discord",
      providerAccountId: user.id,
      username: user.global_name ?? user.username ?? "discord-user",
      email: user.email ?? "",
      avatarUrl: user.avatar
        ? `${AVATAR_CDN_URL}/${user.id}/${user.avatar}.png`
        : null,
    };
  }

  private async fetchMe(accessToken: string): Promise<DiscordUserInfo> {
    const response = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Discord /users/@me failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as DiscordUserInfo;
  }
}
