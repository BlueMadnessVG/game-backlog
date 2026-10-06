import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TOTP, Secret } from "otpauth";

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTotpCodeError,
  OAuthCallbackError,
  TotpNotEnrolledError,
} from "../auth.services";
import { oauthStateStore } from "../auth.state";
import { verifyAuthToken } from "../../../lib/jwt.utils";

vi.mock("../../../lib/password.utils", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { hashPassword, verifyPassword } from "../../../lib/password.utils";

const makeMockDb = () => {
  let self: ReturnType<typeof makeMockDb> = undefined as never;
  const db = {
    // Runs the callback against the same mock, so a `.transaction()` call
    // exercises the exact INSERT/UPDATE chain the real code uses.
    transaction: vi.fn(async (cb: (tx: never) => Promise<unknown>) =>
      cb(self as never),
    ),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  self = db;
  return db;
};

// `.values()` is called once per insert chain; mapping them avoids
// noUncheckedIndexedAccess gripes about `mock.calls[0][0]`.
const insertedValues = (db: ReturnType<typeof makeMockDb>) =>
  db.values.mock.calls.map((call) => call[0]);

const makeMockProvider = () => ({
  createAuthorizationUrl: vi.fn(),
  validateAuthorizationCode: vi.fn(),
});

const makeUser = (overrides = {}) => ({
  id: "user-uuid-1",
  username: "testuser",
  email: "test@example.com",
  passwordHash: null,
  avatarUrl: null,
  totpSecret: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeProfile = (overrides = {}) => ({
  provider: "google",
  providerAccountId: "google-123",
  username: "testuser",
  email: "test@example.com",
  avatarUrl: "https://example.com/avatar.png",
  ...overrides,
});

describe("AuthService", () => {
  let db: ReturnType<typeof makeMockDb>;
  let google: ReturnType<typeof makeMockProvider>;
  let discord: ReturnType<typeof makeMockProvider>;
  let service: AuthService;

  beforeEach(() => {
    db = makeMockDb();
    google = makeMockProvider();
    discord = makeMockProvider();
    service = new AuthService(db as never, {
      google: google as never,
      discord: discord as never,
    });
    vi.mocked(hashPassword).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(hashPassword).mockResolvedValue("argon2-hash");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAuthorizationUrl", () => {
    it("stores state + verifier and returns the provider URL", async () => {
      google.createAuthorizationUrl.mockResolvedValue({
        url: new URL("https://accounts.google.com/auth?state=abc"),
        state: "abc",
        codeVerifier: "verifier-1",
      });

      const url = await service.createAuthorizationUrl("google");

      expect(url.toString()).toBe(
        "https://accounts.google.com/auth?state=abc",
      );

      const stored = oauthStateStore.consume("abc", "google");
      expect(stored).toEqual({
        provider: "google",
        codeVerifier: "verifier-1",
        createdAt: expect.any(Number),
      });
    });
  });

  describe("handleCallback", () => {
    it("rejects an unknown/expired state", async () => {
      await expect(
        service.handleCallback("google", "code-1", "state-that-never-existed"),
      ).rejects.toThrow(OAuthCallbackError);

      expect(google.validateAuthorizationCode).not.toHaveBeenCalled();
    });

    it("creates a new user and signs a session token", async () => {
      db.returning.mockResolvedValue([makeUser()]);

      oauthStateStore.set("state-1", {
        provider: "google",
        codeVerifier: "verifier-1",
        createdAt: Date.now(),
      });
      google.validateAuthorizationCode.mockResolvedValue(makeProfile());

      const result = await service.handleCallback("google", "code-1", "state-1");

      expect(result.created).toBe(true);
      expect(result.user).toEqual({
        id: "user-uuid-1",
        username: "testuser",
        email: "test@example.com",
      });

      const payload = await verifyAuthToken(result.token);
      expect(payload.sub).toBe("user-uuid-1");
      expect(payload.email).toBe("test@example.com");
      expect(payload.provider).toBe("google");
    });

    it("resolves an existing user by provider account", async () => {
      const user = makeUser();
      db.limit.mockResolvedValue([user]);
      discord.validateAuthorizationCode.mockResolvedValue(
        makeProfile({ provider: "discord", providerAccountId: "discord-456" }),
      );

      oauthStateStore.set("state-1", {
        provider: "discord",
        codeVerifier: "verifier-1",
        createdAt: Date.now(),
      });

      const result = await service.handleCallback(
        "discord",
        "code-1",
        "state-1",
      );

      expect(result.created).toBe(false);
      expect(result.user.id).toBe("user-uuid-1");
    });

    it("links a second provider to an existing email match", async () => {
      const existingUser = makeUser();
      db.limit
        .mockResolvedValueOnce([]) // findAccountUser: no matching account
        .mockResolvedValueOnce([existingUser]); // findUserByEmail: email exists
      discord.validateAuthorizationCode.mockResolvedValue(
        makeProfile({ provider: "discord", providerAccountId: "discord-456" }),
      );

      oauthStateStore.set("state-1", {
        provider: "discord",
        codeVerifier: "verifier-1",
        createdAt: Date.now(),
      });

      const result = await service.handleCallback(
        "discord",
        "code-1",
        "state-1",
      );

      expect(result.created).toBe(false);
      expect(result.user.id).toBe("user-uuid-1");
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserById", () => {
    it("returns the user when found", async () => {
      db.limit.mockResolvedValue([makeUser()]);

      const user = await service.getUserById("user-uuid-1");

      expect(user?.id).toBe("user-uuid-1");
    });

    it("returns null when not found", async () => {
      const user = await service.getUserById("missing");
      expect(user).toBeNull();
    });
  });

  describe("getAvailableProviders", () => {
    it("returns every configured provider", () => {
      expect(service.getAvailableProviders()).toEqual(["google", "discord"]);
    });
  });

  describe("register", () => {
    const credentials = {
      username: "newbie",
      email: "  NEW@Example.com  ",
      password: "supersecret123",
    };

    it("hashes the password and signs a token with provider=email", async () => {
      db.limit.mockResolvedValue([]);
      db.returning.mockResolvedValue([
        makeUser({ username: "newbie", email: "new@example.com" }),
      ]);

      const result = await service.register(credentials);

      expect(hashPassword).toHaveBeenCalledWith("supersecret123");
      expect(result.created).toBe(true);
      expect(result.user.email).toBe("new@example.com");

      const payload = await verifyAuthToken(result.token);
      expect(payload.sub).toBe("user-uuid-1");
      expect(payload.email).toBe("new@example.com");
      expect(payload.provider).toBe("email");
    });

    it("rejects an email that is already registered", async () => {
      db.limit.mockResolvedValue([makeUser()]);

      await expect(service.register(credentials)).rejects.toThrow(
        EmailAlreadyRegisteredError,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("wins the race against a concurrent duplicate registration", async () => {
      db.limit
        .mockResolvedValueOnce([]) // initial check: email free
        .mockResolvedValueOnce([makeUser({ email: "new@example.com" })]); // re-read after unique violation
      db.returning.mockResolvedValue([]); // insert "fails" with no row

      await expect(service.register(credentials)).rejects.toThrow(
        EmailAlreadyRegisteredError,
      );
    });
  });

  describe("login", () => {
    const credentials = {
      email: "  Test@Example.com  ",
      password: "supersecret123",
    };

    it("verifies the password and signs a token", async () => {
      db.limit.mockResolvedValue([
        makeUser({ passwordHash: "argon2-hash" }),
      ]);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.login(credentials);

      expect(verifyPassword).toHaveBeenCalledWith(
        "supersecret123",
        "argon2-hash",
      );
      expect(result.created).toBe(false);
      expect(result.user.email).toBe("test@example.com");

      const payload = await verifyAuthToken(result.token);
      expect(payload.provider).toBe("email");
    });

    it("rejects an unknown email without consulting the hasher", async () => {
      db.limit.mockResolvedValue([]);

      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("rejects an OAuth-only account with no password set", async () => {
      db.limit.mockResolvedValue([makeUser({ passwordHash: null })]);

      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("rejects a wrong password", async () => {
      db.limit.mockResolvedValue([
        makeUser({ passwordHash: "argon2-hash" }),
      ]);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
    });
  });

  describe("API token audit trail", () => {
    it("writes a 'created' event in the same transaction as the token", async () => {
      db.returning.mockResolvedValue([{ id: "token-uuid-1" }]);

      const result = await service.createApiToken("user-uuid-1", {
        name: "achievement-ai",
        scope: "read:library",
        audit: {
          triggeredBy: "session",
          ip: "203.0.113.5",
          userAgent: "curl/8.0",
        },
      });

      expect(result.token).toMatch(/^bkl_/);
      expect(result.id).toBe("token-uuid-1");
      expect(db.transaction).toHaveBeenCalledTimes(1);

      // call 0 = apiTokens insert, call 1 = apiTokenEvents insert, both
      // running against the same tx.
      expect(insertedValues(db)[0]).toMatchObject({
        userId: "user-uuid-1",
        name: "achievement-ai",
        scope: "read:library",
        tokenHash: expect.any(String),
        tokenPrefix: expect.any(String),
        expiresAt: null,
      });
      expect(insertedValues(db)[1]).toEqual({
        tokenId: "token-uuid-1",
        userId: "user-uuid-1",
        action: "created",
        metadata: {
          triggeredBy: "session",
          ip: "203.0.113.5",
          userAgent: "curl/8.0",
        },
      });
    });

    it("defaults token scope to read:library", async () => {
      db.returning.mockResolvedValue([{ id: "token-uuid-1" }]);

      await service.createApiToken("user-uuid-1", {
        name: "default-scope",
        audit: { triggeredBy: "session", ip: "unknown", userAgent: null },
      });

      expect(insertedValues(db)[0]).toMatchObject({
        scope: "read:library",
        expiresAt: null,
      });
    });

    it("records a 'revoked' event only when a token is actually revoked", async () => {
      db.returning.mockResolvedValue([{ id: "token-uuid-1" }]);

      const revoked = await service.revokeApiToken(
        "user-uuid-1",
        "token-uuid-1",
        {
          triggeredBy: "apiToken",
          ip: "192.0.2.10",
          userAgent: "achievement-ai/1.0",
        },
      );

      expect(revoked).toBe(true);
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(insertedValues(db)[0]).toEqual({
        tokenId: "token-uuid-1",
        userId: "user-uuid-1",
        action: "revoked",
        metadata: {
          triggeredBy: "apiToken",
          ip: "192.0.2.10",
          userAgent: "achievement-ai/1.0",
        },
      });
    });

    it("writes NO event when the token id does not belong to the user", async () => {
      db.returning.mockResolvedValue([]);

      const revoked = await service.revokeApiToken(
        "user-uuid-1",
        "someone-elses-token",
        { triggeredBy: "session", ip: "unknown", userAgent: null },
      );

      expect(revoked).toBe(false);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("TOTP step-up", () => {
    const enrolledUser = () =>
      makeUser({ totpSecret: new Secret({ size: 20 }).base32 });

    describe("enrollTotp", () => {
      it("verifies the code BEFORE persisting, then stores the secret", async () => {
        db.limit.mockResolvedValue([makeUser()]);
        vi.spyOn(TOTP.prototype, "validate").mockReturnValue(1);

        const result = await service.enrollTotp("user-uuid-1", "123456");

        expect(result.secret).toMatch(/^[A-Z2-7]+={0,3}$/);
        expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
        expect(result.otpauthUrl).toContain("game-backlog");
        expect(db.set).toHaveBeenCalledWith({
          totpSecret: result.secret,
        });
      });

      it("rejects a wrong code and does NOT persist the secret", async () => {
        db.limit.mockResolvedValue([makeUser()]);
        vi.spyOn(TOTP.prototype, "validate").mockReturnValue(null);

        await expect(
          service.enrollTotp("user-uuid-1", "000000"),
        ).rejects.toThrow(InvalidTotpCodeError);
        expect(db.update).not.toHaveBeenCalled();
      });
    });

    describe("stepUpTotp", () => {
      it("signs a short-lived step-up token when the code matches", async () => {
        const secret = new Secret({ size: 20 }).base32;
        db.limit.mockResolvedValue([makeUser({ totpSecret: secret })]);

        const code = new TOTP({ secret: Secret.fromBase32(secret) }).generate();
        const before = Date.now();
        const result = await service.stepUpTotp("user-uuid-1", code);

        // 5-minute TTL: measured from `before` (captured before the call)
        // it lands in [5m, 5m + 1s] — the service stamps Date.now() when
        // signing, which is always >= `before` by a few ms.
        const ttl = result.expiresAt.getTime() - before;
        expect(ttl).toBeGreaterThanOrEqual(5 * 60_000);
        expect(ttl).toBeLessThan(5 * 60_000 + 1_000);

        const payload = await verifyAuthToken(result.token, {
          allowPurpose: ["session", "step_up"],
        });
        expect(payload.sub).toBe("user-uuid-1");
        expect(payload.provider).toBe("step_up");
        expect(payload.purpose).toBe("step_up");
      });

      it("rejects a wrong code with InvalidTotpCodeError", async () => {
        db.limit.mockResolvedValue([enrolledUser()]);

        await expect(
          service.stepUpTotp("user-uuid-1", "000000"),
        ).rejects.toThrow(InvalidTotpCodeError);
      });

      it("rejects step-up for a user with no enrolled secret", async () => {
        db.limit.mockResolvedValue([makeUser({ totpSecret: null })]);

        await expect(
          service.stepUpTotp("user-uuid-1", "123456"),
        ).rejects.toThrow(TotpNotEnrolledError);
      });
    });

    describe("hasTotpEnrolled", () => {
      it("returns true when the user has a secret", async () => {
        db.limit.mockResolvedValue([enrolledUser()]);

        await expect(service.hasTotpEnrolled("user-uuid-1")).resolves.toBe(
          true,
        );
      });

      it("returns false when the user has no secret", async () => {
        db.limit.mockResolvedValue([makeUser({ totpSecret: null })]);

        await expect(service.hasTotpEnrolled("user-uuid-1")).resolves.toBe(
          false,
        );
      });
    });
  });
});
