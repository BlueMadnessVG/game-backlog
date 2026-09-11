import { and, eq } from "drizzle-orm";

import type { LoginInput, OAuthProvider, RegisterInput } from "@repo/shared";

import { oauthAccounts, users } from "../../db/schema";
import type { DbClient } from "../../db";
import { signAuthToken } from "../../lib/jwt.utils";
import { hashPassword, verifyPassword } from "../../lib/password.utils";
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

/**
 * Thrown when a registration tries to use an email that already belongs to an
 * existing account (password or OAuth). Maps to HTTP 409.
 */
export class EmailAlreadyRegisteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Thrown when the email/password pair does not match. Intentionally the same
 * error for "unknown email" and "wrong password" so sign-in attempts cannot
 * enumerate which emails have registered accounts. Maps to HTTP 401.
 */
export class InvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Normalizes the credential login method into the JWT `provider` claim. The
 * auth middleware only reads `sub`/`email`, so nothing downstream changes.
 */
const EMAIL_PROVIDER = "email" as const;

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
   * List of configured social providers. The frontend decides which of these
   * to surface (currently only Google); adding a new platform later means
   * registering it in `index.ts` and nothing else changes here.
   */
  getAvailableProviders(): OAuthProvider[] {
    return Object.keys(this.providers) as OAuthProvider[];
  }

  /**
   * Creates an email/password account and issues a session token.
   *
   * Emails are normalized (trimmed + lowercased) before the uniqueness check
   * so `Foo@Bar.com` and `foo@bar.com` cannot create duplicate accounts.
   *
   * @throws {EmailAlreadyRegisteredError} When the email is already in use.
   */
  async register(input: RegisterInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const [user] = await this.db
        .insert(users)
        .values({
          username: input.username.trim(),
          email,
          passwordHash,
        })
        .returning();

      if (!user) {
        throw new Error("Failed to create user");
      }

      const token = await this.#signEmailSession(user);
      return {
        token,
        user: { id: user.id, username: user.username, email: user.email },
        created: true,
      };
    } catch (error) {
      // Race: another request registered the same email first. Resolve the
      // winner instead of leaking a unique-violation stack trace.
      const winner = await this.findUserByEmail(email);
      if (winner) {
        throw new EmailAlreadyRegisteredError("Email is already registered");
      }
      throw error;
    }
  }

  /**
   * Validates an email/password pair and issues a session token.
   *
   * Unknown emails, password-less (OAuth-only) accounts, and wrong passwords
   * all produce the same {@link InvalidCredentialsError} to prevent account
   * enumeration.
   *
   * @throws {InvalidCredentialsError} When the credentials do not match.
   */
  async login(input: LoginInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);

    if (!user?.passwordHash) {
      throw new InvalidCredentialsError("Invalid email or password");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError("Invalid email or password");
    }

    const token = await this.#signEmailSession(user);
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email },
      created: false,
    };
  }

  async #signEmailSession(
    user: { id: string; username: string; email: string },
  ) {
    return signAuthToken({
      sub: user.id,
      email: user.email,
      provider: EMAIL_PROVIDER,
    });
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
