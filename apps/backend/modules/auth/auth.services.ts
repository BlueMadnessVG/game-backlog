import { and, eq } from "drizzle-orm";
import { TOTP, Secret } from "otpauth";

import type { LoginInput, OAuthProvider, RegisterInput } from "@repo/shared";

import { apiTokenEvents, apiTokens, oauthAccounts, users } from "../../db/schema";
import type { DbClient } from "../../db";
import { signAuthToken } from "../../lib/jwt.utils";
import { hashPassword, verifyPassword } from "../../lib/password.utils";
import { generateOpaqueToken, hashApiToken } from "../../lib/api-token.utils";
import type {
  OAuthProfile,
  OAuthProviderClient,
} from "../../providers/oauth.types";
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
 * Thrown when a TOTP step-up is attempted but the user has no enrolled
 * secret (users.totpSecret is null). Maps to 400 — there is nothing to
 * verify against, and minting doesn't require step-up for such users.
 */
export class TotpNotEnrolledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TotpNotEnrolledError";
  }
}

/**
 * Thrown when the presented TOTP code does not match the user's enrolled
 * secret (or, for enrollment, the freshly generated one). Maps to 400.
 * See TextSecure's guidance: no generic messages, no rate-limit hint churn —
 * just "code did not verify".
 */
export class InvalidTotpCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTotpCodeError";
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

export interface ApiTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Who/where triggered an API-token lifecycle event, stored in the
 * append-only api_token_events table (db/schema/api-token.ts). Captured by
 * the controller from request context — a service layer has no access to
 * IP/User-Agent, so callers must pass it in rather than the service
 * guessing.
 */
export interface ApiTokenAuditContext {
  /** Which credential kind performed the action ("session" for a browser/user, "apiToken" for a machine self-revoking itself). */
  triggeredBy: "session" | "apiToken";
  ip: string;
  userAgent: string | null;
}

/**
 * Orchestrates the OAuth registration/login flow, session issuance, and
 * (now) opaque API token issuance for machine/service clients — API
 * tokens are a second credential kind in the same "how does this user
 * authenticate" domain this class already owns, so they live here rather
 * than in a separate service.
 *
 * @example
 * ```ts
 * const auth = new AuthService(db, { google, discord });
 * const url = await auth.createAuthorizationUrl("google");
 * const { token, user } = await auth.handleCallback("google", code, state);
 * const apiToken = await auth.createApiToken(user.id, { name: "achievement-ai" });
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

  async #signEmailSession(user: {
    id: string;
    username: string;
    email: string;
  }) {
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

  // ---------------------------------------------------------------------
  // API tokens — a second credential kind (see lib/api-token.utils.ts for
  // the pure generate/hash/isApiToken helpers this calls into).
  // ---------------------------------------------------------------------

  /**
   * Creates a new opaque API token for `userId` (e.g. for the
   * achievement-ai assistant, or any other machine client).
   *
   * The token row and its "created" audit event are written in the SAME
   * transaction, so a minted token can never exist without a record of
   * who minted it (see api_token_events in db/schema/api-token.ts).
   *
   * @param audit - Request context (credential kind, IP, User-Agent) the
   *   controller captures and passes down; the service itself has no
   *   access to the HTTP request.
   * @returns The plaintext token — returned exactly ONCE, here. Only its
   *   hash is ever persisted; there is no way to recover it later.
   */
  async createApiToken(
    userId: string,
    opts: {
      name: string;
      scope?: string;
      expiresAt?: Date;
      audit: ApiTokenAuditContext;
    },
  ): Promise<{ id: string; token: string; tokenPrefix: string }> {
    const { token, tokenHash, tokenPrefix } = generateOpaqueToken();

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(apiTokens)
        .values({
          userId,
          name: opts.name,
          tokenHash,
          tokenPrefix,
          scope: opts.scope ?? "read:library",
          expiresAt: opts.expiresAt ?? null,
        })
        .returning({ id: apiTokens.id });

      if (!row) {
        throw new Error("Failed to create API token");
      }

      await tx.insert(apiTokenEvents).values({
        tokenId: row.id,
        userId,
        action: "created",
        metadata: opts.audit,
      });

      return row;
    });

    return { id: created.id, token, tokenPrefix };
  }

  /**
   * Verifies an opaque API token — called from auth.middleware for any
   * `bkl_...`-prefixed bearer credential. Mirrors verifyAuthToken's
   * "give me a userId or nothing" contract (jwt.utils.ts) so the
   * middleware can treat both credential kinds the same way once it
   * knows which one it has.
   *
   * Returns the token's stored `scope` and `tokenId` in addition to
   * `userId` so the middleware can (a) enforce scope on mutating methods
   * and (b) identify the exact row for audit/revocation. Contract:
   * `{ userId, scope, tokenId }`, or `null` if the token is unknown,
   * revoked, or past its expiry.
   */
  async verifyApiToken(
    token: string,
  ): Promise<{ userId: string; scope: string; tokenId: string } | null> {
    const tokenHash = hashApiToken(token);

    const rows = await this.db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        scope: apiTokens.scope,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    if (!row || row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    // Fire-and-forget, matching the background-job style this codebase
    // already uses for sync/enrichment (see xbox/steam/psn controllers) —
    // a request shouldn't be slowed down or fail because this
    // bookkeeping write is slow.
    void this.db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.id))
      .catch((err: unknown) => {
        console.error("[AuthService] Failed to update token lastUsedAt:", err);
      });

    return { userId: row.userId, scope: row.scope, tokenId: row.id };
  }

  /** Lists a user's API tokens. Never includes the secret — only the prefix. */
  async listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
    return this.db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        tokenPrefix: apiTokens.tokenPrefix,
        scope: apiTokens.scope,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId));
  }

  /**
   * Revokes a token (soft delete — see api-tokens.ts schema comment).
   * Scoped to `userId` so one user can never revoke another user's token
   * by guessing an id.
   *
   * The revoke and its "revoked" audit event share a transaction, and the
   * event is written ONLY when a row was actually updated — revoking a
   * non-existent/foreign id changes nothing and leaves no audit trail,
   * so the table stays an accurate record.
   *
   * @param audit - Request context (credential kind, IP, User-Agent) the
   *   controller captures and passes down.
   * @returns Whether any token was revoked (false = unknown id, or a token
   *   belonging to a different user).
   */
  async revokeApiToken(
    userId: string,
    tokenId: string,
    audit: ApiTokenAuditContext,
  ): Promise<boolean> {
    let revoked = false;

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
        .returning({ id: apiTokens.id });

      if (!row) return;

      revoked = true;
      await tx.insert(apiTokenEvents).values({
        tokenId,
        userId,
        action: "revoked",
        metadata: audit,
      });
    });

    return revoked;
  }

  // ---------------------------------------------------------------------
  // TOTP step-up — optional per-user MFA protecting API-token minting.
  // ---------------------------------------------------------------------

  /** Shown in authenticator apps; keep stable even if the app is renamed. */
  private static readonly TOTP_ISSUER = "game-backlog";
  /** Step-up JWTs expire fast — they exist only to unlock one mint call. */
  private static readonly STEP_UP_TTL_MS = 5 * 60 * 1000;
  /** Allow one 30s window of clock/delay skew when verifying a code. */
  private static readonly TOTP_WINDOW = 1;

  /**
   * Enrolls the user in TOTP MFA.
   *
   * Generates a fresh secret, verifies the presented code against it BEFORE
   * persisting — enrollment proves the user actually scanned the secret into
   * an authenticator, because a secret nobody saved would lock token minting
   * behind an unwinnable step-up — and only then stores the base32 secret.
   *
   * Re-enrolling rotates the secret and invalidates any older authenticator
   * entry; the returned otpauth URL must be scanned again.
   *
   * @returns The base32 secret and an `otpauth://` URL. The secret is
   *   returned ONCE, like an API token's plaintext; never exposed again.
   */
  async enrollTotp(
    userId: string,
    code: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error("User not found");
    }

    const totp = new TOTP({
      issuer: AuthService.TOTP_ISSUER,
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new Secret({ size: 20 }),
    });

    if (!this.#validateTotpCode(totp, code)) {
      throw new InvalidTotpCodeError("TOTP code did not verify");
    }

    const secret = totp.secret.base32;
    await this.db
      .update(users)
      .set({ totpSecret: secret })
      .where(eq(users.id, userId));

    return { secret, otpauthUrl: totp.toString() };
  }

  /**
   * Verifies a TOTP code against the user's enrolled secret and, on
   * success, signs a SHORT-LIVED `purpose: "step_up"` session token.
   *
   * Only-if-enrolled: a user without a secret hits
   * {@link TotpNotEnrolledError} and is NOT eligible for step-up — they
   * mint API tokens on a plain session instead. The step-up token is
   * accepted ONLY by POST /auth/api-tokens (auth.middleware with
   * allowStepUp); everywhere else verifyAuthToken rejects its purpose
   * claim, so a leaked 5-minute token can't escalate into a general
   * session.
   */
  async stepUpTotp(
    userId: string,
    code: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        totpSecret: users.totpSecret,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.totpSecret) {
      throw new TotpNotEnrolledError("TOTP is not enrolled for this user");
    }

    const totp = new TOTP({ secret: Secret.fromBase32(user.totpSecret) });
    if (!this.#validateTotpCode(totp, code)) {
      throw new InvalidTotpCodeError("TOTP code did not verify");
    }

    const expiresAt = new Date(Date.now() + AuthService.STEP_UP_TTL_MS);
    const token = await signAuthToken(
      {
        sub: user.id,
        email: user.email,
        provider: "step_up",
        purpose: "step_up",
      },
      expiresAt,
    );

    return { token, expiresAt };
  }

  /** Whether the user has an enrolled TOTP secret (null = not enrolled). */
  async hasTotpEnrolled(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ totpSecret: users.totpSecret })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return !!row?.totpSecret;
  }

  #validateTotpCode(totp: TOTP, code: string): boolean {
    return totp.validate({
      token: code,
      window: AuthService.TOTP_WINDOW,
    }) !== null;
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
