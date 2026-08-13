import { and, eq } from "drizzle-orm";

import type { OAuthProvider } from "@repo/shared";

import { oauthAccounts, users } from "../../db/schema";
import type { DbClient } from "../../db";
import { signAuthToken } from "../../lib/jwt.utils";
import type { OAuthProfile, OAuthProviderClient } from "../../providers/oauth.types";
import { oauthStateStore } from "./auth.state";

/**
 * Thrown when the OAuth callback state is missing, stale, or already used —
 * the sign-in attempt should be aborted and the user bounced back to the
 * frontend with an error fragment.
 */
export class OAuthCallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthCallbackError";
  }
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  created: boolean;
}

/**
 * Orchestrates the OAuth registration/login flow and session issuance.
 *
 * First-time sign-in auto-registers the user (users + oauth_accounts rows);
 * returning users are resolved by (provider, providerAccountId), with an
 * email fallback so a user signing in with a second provider links to their
 * existing account instead of creating a duplicate.
 *
 * @example
 * ```ts
 * const auth = new AuthService(db, { google, discord });
 * const url = await auth.createAuthorizationUrl("google");
 * const { token, user } = await auth.handleCallback("google", code, state);
 * ```
 */
export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly providers: Record<OAuthProvider, OAuthProviderClient>,
  ) {}

  /**
   * Builds the provider authorize URL and stores its state + PKCE verifier
   * for the callback to consume.
   */
  async createAuthorizationUrl(provider: OAuthProvider): Promise<URL> {
    const client = this.providers[provider];
    const { url, state, codeVerifier } = await client.createAuthorizationUrl();
    oauthStateStore.set(state, {
      provider,
      codeVerifier,
      createdAt: Date.now(),
    });
    return url;
  }

  /**
   * Completes the OAuth callback: validates the state, exchanges the code
   * for a profile, upserts the user, and signs a session JWT.
   *
   * @param provider - Which OAuth provider handled the flow.
   * @param code - The authorization code from the callback query.
   * @param state - The state echoed back by the provider.
   * @throws {OAuthCallbackError} When the state is invalid/expired.
   * @returns The signed token, the resolved user, and whether this sign-in
   *   created a brand-new user.
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<AuthSession> {
    const stored = oauthStateStore.consume(state, provider);
    if (!stored) {
      throw new OAuthCallbackError("Invalid or expired OAuth state");
    }

    const profile = await this.providers[provider].validateAuthorizationCode(
      code,
      stored.codeVerifier,
    );

    const { user, created } = await this.upsertUser(profile);
    const token = await signAuthToken({
      sub: user.id,
      email: user.email,
      provider,
    });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email },
      created,
    };
  }

  /**
   * Resolves a user by internal id (used by the protected /auth/me route).
   */
  async getUserById(userId: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async findAccountUser(profile: OAuthProfile) {
    const rows = await this.db
      .select({ user: users })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(
        and(
          eq(oauthAccounts.provider, profile.provider),
          eq(oauthAccounts.providerAccountId, profile.providerAccountId),
        ),
      )
      .limit(1);
    return rows[0]?.user ?? null;
  }

  private async findUserByEmail(email: string) {
    if (!email) return null;
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  private async linkAccount(userId: string, profile: OAuthProfile) {
    await this.db
      .insert(oauthAccounts)
      .values({
        userId,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email || null,
        avatarUrl: profile.avatarUrl,
      })
      .onConflictDoNothing();
  }

  private async upsertUser(profile: OAuthProfile) {
    const existing = await this.findAccountUser(profile);
    if (existing) return { user: existing, created: false };

    const byEmail = await this.findUserByEmail(profile.email);
    if (byEmail) {
      await this.linkAccount(byEmail.id, profile);
      return { user: byEmail, created: false };
    }

    try {
      const [user] = await this.db
        .insert(users)
        .values({
          username: profile.username,
          email: profile.email,
        })
        .returning();

      if (!user) {
        throw new Error("Failed to create user");
      }

      await this.linkAccount(user.id, profile);
      return { user, created: true };
    } catch (error) {
      // Race: another request created the user/account first. Re-read and
      // return the winner instead of crashing on a unique violation.
      const winner =
        (await this.findAccountUser(profile)) ??
        (await this.findUserByEmail(profile.email));
      if (winner) return { user: winner, created: false };
      throw error;
    }
  }
}
