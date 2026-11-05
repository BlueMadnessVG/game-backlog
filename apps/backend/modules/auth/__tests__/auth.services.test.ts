import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { TOTP, Secret } from "otpauth";

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTotpCodeError,
  OAuthCallbackError,
  TotpEnrollmentNotStartedError,
  TotpNotEnrolledError,
} from "../auth.services";
import { oauthStateStore } from "../auth.state";
import { apiTokenEvents, apiTokens, oauthAccounts, users } from "../../../db/schema";
import { verifyAuthToken } from "../../../lib/jwt.utils";
import { decrypt, encrypt } from "../../../lib/Encryption.utils";
import { createTestDb, type TestDb } from "../../../tests/test-db";

// argon2 is deliberately slow; password hashing is not what these tests prove.
vi.mock("../../../lib/password.utils", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { hashPassword, verifyPassword } from "../../../lib/password.utils";

const makeMockProvider = () => ({
  createAuthorizationUrl: vi.fn(),
  validateAuthorizationCode: vi.fn(),
});

const makeProfile = (overrides = {}) => ({
  provider: "google",
  providerAccountId: "google-123",
  username: "testuser",
  email: "test@example.com",
  avatarUrl: "https://example.com/avatar.png",
  ...overrides,
});

const audit = {
  triggeredBy: "session" as const,
  ip: "203.0.113.5",
  userAgent: "curl/8.0",
};

describe("AuthService (real database)", () => {
  let t: TestDb;
  let google: ReturnType<typeof makeMockProvider>;
  let discord: ReturnType<typeof makeMockProvider>;
  let service: AuthService;

  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    google = makeMockProvider();
    discord = makeMockProvider();
    service = new AuthService(t.db, {
      google: google as never,
      discord: discord as never,
    });
    vi.mocked(hashPassword).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(hashPassword).mockResolvedValue("argon2-hash");
  });

  const insertUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const [user] = await t.db
      .insert(users)
      .values({ username: "testuser", email: "test@example.com", ...overrides })
      .returning();
    return user!;
  };

  const allUsers = () => t.db.select().from(users);

  const oauthLogin = async (
    provider: "google" | "discord",
    profile: ReturnType<typeof makeProfile>,
  ) => {
    const mock = provider === "google" ? google : discord;
    mock.validateAuthorizationCode.mockResolvedValue(profile);
    oauthStateStore.set("state-1", {
      provider,
      codeVerifier: "verifier-1",
      createdAt: Date.now(),
    });
    return service.handleCallback(provider, "code-1", "state-1");
  };

  describe("createAuthorizationUrl", () => {
    it("stores state + verifier and returns the provider URL", async () => {
      google.createAuthorizationUrl.mockResolvedValue({
        url: new URL("https://accounts.google.com/auth?state=abc"),
        state: "abc",
        codeVerifier: "verifier-1",
      });

      const url = await service.createAuthorizationUrl("google");

      expect(url.toString()).toBe("https://accounts.google.com/auth?state=abc");
      expect(oauthStateStore.consume("abc", "google")).toEqual({
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

    it("creates a user and its provider account, and signs a session token", async () => {
      const result = await oauthLogin("google", makeProfile());

      expect(result.created).toBe(true);
      const [user] = await allUsers();
      expect(result.user).toEqual({
        id: user!.id,
        username: "testuser",
        email: "test@example.com",
      });
      const accounts = await t.db.select().from(oauthAccounts);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        userId: user!.id,
        provider: "google",
        providerAccountId: "google-123",
      });

      const payload = await verifyAuthToken(result.token);
      expect(payload.sub).toBe(user!.id);
      expect(payload.email).toBe("test@example.com");
      expect(payload.provider).toBe("google");
    });

    it("signs the same user in again on the next login", async () => {
      const first = await oauthLogin("google", makeProfile());
      const second = await oauthLogin("google", makeProfile());

      expect(second.created).toBe(false);
      expect(second.user.id).toBe(first.user.id);
      expect(await allUsers()).toHaveLength(1);
      expect(await t.db.select().from(oauthAccounts)).toHaveLength(1);
    });

    it("links a second provider to the user with the same email", async () => {
      const first = await oauthLogin("google", makeProfile());

      const second = await oauthLogin(
        "discord",
        makeProfile({ provider: "discord", providerAccountId: "discord-456" }),
      );

      expect(second.created).toBe(false);
      expect(second.user.id).toBe(first.user.id);
      expect(await allUsers()).toHaveLength(1);
      const providers = (await t.db.select().from(oauthAccounts))
        .map((a) => a.provider)
        .sort();
      expect(providers).toEqual(["discord", "google"]);
    });

    it("links to a password account whose email differs only by case, instead of creating a second user", async () => {
      // register() stores emails lowercased; a provider may report any case.
      const registered = await insertUser({ email: "ann@example.com" });

      const result = await oauthLogin(
        "google",
        makeProfile({ email: "Ann@Example.com" }),
      );

      expect(result.created).toBe(false);
      expect(result.user.id).toBe(registered.id);
      expect(await allUsers()).toHaveLength(1);
    });

    it("keeps two different users' provider accounts apart", async () => {
      const a = await oauthLogin("google", makeProfile());
      const b = await oauthLogin(
        "google",
        makeProfile({
          providerAccountId: "google-999",
          email: "other@example.com",
          username: "other",
        }),
      );

      expect(b.created).toBe(true);
      expect(b.user.id).not.toBe(a.user.id);
    });
  });

  describe("users.email (database constraint)", () => {
    it("refuses a second row whose email differs only by case, whatever code wrote it", async () => {
      await insertUser({ email: "ann@example.com" });

      // A raw insert: no service code, so only the database can stop it.
      await expect(
        insertUser({ email: "Ann@Example.com", username: "ann2" }),
      ).rejects.toThrow();
      expect(await allUsers()).toHaveLength(1);
    });
  });

  describe("getUserById", () => {
    it("returns the user when found", async () => {
      const user = await insertUser();

      expect((await service.getUserById(user.id))?.id).toBe(user.id);
    });

    it("returns null when not found", async () => {
      await insertUser();

      expect(
        await service.getUserById("00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
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

    it("stores a normalised user with the hashed password and signs an email token", async () => {
      const result = await service.register(credentials);

      expect(hashPassword).toHaveBeenCalledWith("supersecret123");
      expect(result.created).toBe(true);
      expect(result.user.email).toBe("new@example.com");
      const [user] = await allUsers();
      expect(user).toMatchObject({
        username: "newbie",
        email: "new@example.com",
        passwordHash: "argon2-hash",
      });

      const payload = await verifyAuthToken(result.token);
      expect(payload.sub).toBe(user!.id);
      expect(payload.provider).toBe("email");
    });

    it("rejects an email that is already registered, whatever its case", async () => {
      await insertUser({ email: "new@example.com" });

      await expect(service.register(credentials)).rejects.toThrow(
        EmailAlreadyRegisteredError,
      );
      expect(await allUsers()).toHaveLength(1);
    });

    it("rejects an email that differs from a registered one only by case", async () => {
      await insertUser({ email: "ann@example.com" });

      await expect(
        service.register({ username: "ann2", email: "ANN@example.com", password: "supersecret123" }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);
      expect(await allUsers()).toHaveLength(1);
    });

    it("lets exactly one of two simultaneous registrations win", async () => {
      // Both pass the "email is free" check; the database's unique constraint
      // decides, and the loser gets the friendly error instead of a raw
      // unique-violation.
      const results = await Promise.allSettled([
        service.register(credentials),
        service.register(credentials),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failure = results.find((r) => r.status === "rejected");
      expect((failure as PromiseRejectedResult).reason).toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
      expect(await allUsers()).toHaveLength(1);
    });
  });

  describe("login", () => {
    const credentials = {
      email: "  Test@Example.com  ",
      password: "supersecret123",
    };

    it("verifies the password against the stored hash and signs a token", async () => {
      const user = await insertUser({ passwordHash: "argon2-hash" });
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.login(credentials);

      expect(verifyPassword).toHaveBeenCalledWith("supersecret123", "argon2-hash");
      expect(result.created).toBe(false);
      expect(result.user).toEqual({
        id: user.id,
        username: "testuser",
        email: "test@example.com",
      });
      expect((await verifyAuthToken(result.token)).provider).toBe("email");
    });

    it("finds an account stored with mixed case (written before emails were normalised)", async () => {
      const legacy = await insertUser({ email: "Test@Example.com", passwordHash: "argon2-hash" });
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.login(credentials);

      expect(result.user.id).toBe(legacy.id);
    });

    it("rejects an unknown email without consulting the hasher", async () => {
      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("rejects an OAuth-only account with no password set", async () => {
      await insertUser({ passwordHash: null });

      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("rejects a wrong password", async () => {
      await insertUser({ passwordHash: "argon2-hash" });
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(service.login(credentials)).rejects.toThrow(
        InvalidCredentialsError,
      );
    });
  });

  describe("API tokens", () => {
    const events = () => t.db.select().from(apiTokenEvents);

    describe("createApiToken", () => {
      it("stores only the hash, and writes the 'created' event with the token", async () => {
        const user = await insertUser();

        const result = await service.createApiToken(user.id, {
          name: "achievement-ai",
          audit,
        });

        expect(result.token).toMatch(/^bkl_/);
        const [row] = await t.db.select().from(apiTokens);
        expect(row).toMatchObject({
          id: result.id,
          userId: user.id,
          name: "achievement-ai",
          scope: "read:library", // the default
          expiresAt: null,
        });
        expect(row!.tokenHash).not.toContain(result.token);
        expect(await events()).toEqual([
          expect.objectContaining({
            tokenId: result.id,
            userId: user.id,
            action: "created",
            metadata: audit,
          }),
        ]);
      });

      it("keeps neither the token nor an event when the audit write fails", async () => {
        // The point of the transaction: a token must never exist without its
        // record. Make the second insert fail for real, in the database.
        const user = await insertUser();
        // One statement per call: the driver rejects multi-statement strings.
        await t.db.execute(sql.raw(`
          CREATE FUNCTION fail_audit() RETURNS trigger AS $$
          BEGIN RAISE EXCEPTION 'audit unavailable'; END $$ LANGUAGE plpgsql
        `));
        await t.db.execute(sql.raw(`
          CREATE TRIGGER fail_audit BEFORE INSERT ON api_token_events
            FOR EACH ROW EXECUTE FUNCTION fail_audit()
        `));

        try {
          await expect(
            service.createApiToken(user.id, { name: "doomed", audit }),
          ).rejects.toThrow();
        } finally {
          await t.db.execute(sql.raw(`DROP TRIGGER fail_audit ON api_token_events`));
          await t.db.execute(sql.raw(`DROP FUNCTION fail_audit()`));
        }

        expect(await t.db.select().from(apiTokens)).toHaveLength(0);
        expect(await events()).toHaveLength(0);
      });
    });

    describe("verifyApiToken", () => {
      const mint = async (
        userId: string,
        opts: { scope?: string; expiresAt?: Date } = {},
      ) => service.createApiToken(userId, { name: "t", audit, ...opts });

      it("returns the owner, scope and token id for a valid token", async () => {
        const user = await insertUser();
        const minted = await mint(user.id, { scope: "read:library" });

        expect(await service.verifyApiToken(minted.token)).toEqual({
          userId: user.id,
          scope: "read:library",
          tokenId: minted.id,
        });
      });

      it("records when the token was last used", async () => {
        const user = await insertUser();
        const minted = await mint(user.id);

        await service.verifyApiToken(minted.token);

        // The write is fire-and-forget by design, so wait for it.
        await vi.waitFor(async () => {
          const [row] = await t.db
            .select()
            .from(apiTokens)
            .where(eq(apiTokens.id, minted.id));
          expect(row!.lastUsedAt).toBeInstanceOf(Date);
        });
      });

      it("rejects a token it has never seen", async () => {
        const user = await insertUser();
        await mint(user.id);

        expect(await service.verifyApiToken("bkl_not-a-real-token")).toBeNull();
      });

      it("rejects a revoked token", async () => {
        const user = await insertUser();
        const minted = await mint(user.id);
        await service.revokeApiToken(user.id, minted.id, audit);

        expect(await service.verifyApiToken(minted.token)).toBeNull();
      });

      it("rejects an expired token but accepts one that expires later", async () => {
        const user = await insertUser();
        const expired = await mint(user.id, {
          expiresAt: new Date(Date.now() - 60_000),
        });
        const live = await mint(user.id, {
          expiresAt: new Date(Date.now() + 3_600_000),
        });

        expect(await service.verifyApiToken(expired.token)).toBeNull();
        expect(await service.verifyApiToken(live.token)).not.toBeNull();
      });
    });

    describe("listApiTokens", () => {
      it("lists only the caller's tokens, never the secret", async () => {
        const alice = await insertUser({ email: "alice@example.com" });
        const bob = await insertUser({ email: "bob@example.com", username: "bob" });
        await service.createApiToken(alice.id, { name: "alice-1", audit });
        await service.createApiToken(alice.id, { name: "alice-2", audit });
        await service.createApiToken(bob.id, { name: "bob-1", audit });

        const listed = await service.listApiTokens(alice.id);

        expect(listed.map((x) => x.name).sort()).toEqual(["alice-1", "alice-2"]);
        expect(JSON.stringify(listed)).not.toContain("tokenHash");
      });
    });

    describe("revokeApiToken", () => {
      it("revokes the user's own token and records a 'revoked' event", async () => {
        const user = await insertUser();
        const minted = await service.createApiToken(user.id, { name: "t", audit });
        const revokeAudit = {
          triggeredBy: "apiToken" as const,
          ip: "192.0.2.10",
          userAgent: "achievement-ai/1.0",
        };

        const revoked = await service.revokeApiToken(user.id, minted.id, revokeAudit);

        expect(revoked).toBe(true);
        const [row] = await t.db.select().from(apiTokens);
        expect(row!.revokedAt).toBeInstanceOf(Date);
        const revokedEvents = (await events()).filter((e) => e.action === "revoked");
        expect(revokedEvents).toEqual([
          expect.objectContaining({
            tokenId: minted.id,
            userId: user.id,
            metadata: revokeAudit,
          }),
        ]);
      });

      it("cannot revoke another user's token, and leaves no event", async () => {
        const alice = await insertUser({ email: "alice@example.com" });
        const mallory = await insertUser({ email: "mallory@example.com", username: "mallory" });
        const minted = await service.createApiToken(alice.id, { name: "t", audit });

        const revoked = await service.revokeApiToken(mallory.id, minted.id, audit);

        expect(revoked).toBe(false);
        const [row] = await t.db.select().from(apiTokens);
        expect(row!.revokedAt).toBeNull();
        expect((await events()).map((e) => e.action)).toEqual(["created"]);
        expect(await service.verifyApiToken(minted.token)).not.toBeNull();
      });

      it("returns false, with no event, for an id that does not exist", async () => {
        const user = await insertUser();

        const revoked = await service.revokeApiToken(
          user.id,
          "00000000-0000-0000-0000-000000000000",
          audit,
        );

        expect(revoked).toBe(false);
        expect(await events()).toHaveLength(0);
      });
    });
  });

  describe("TOTP", () => {
    const codeFor = (secret: string) =>
      new TOTP({ secret: Secret.fromBase32(secret) }).generate();
    const stored = async (id: string) => {
      const [row] = await t.db.select().from(users).where(eq(users.id, id));
      return row!;
    };

    describe("startTotpEnrollment", () => {
      it("stores the secret encrypted as PENDING and never enables it", async () => {
        const user = await insertUser();

        const result = await service.startTotpEnrollment(user.id);

        expect(result.secret).toMatch(/^[A-Z2-7]+={0,3}$/);
        expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
        expect(result.otpauthUrl).toContain("game-backlog");
        const row = await stored(user.id);
        expect(row.totpSecret).toBeNull();
        expect(row.totpPendingSecret).not.toContain(result.secret);
        expect(decrypt(row.totpPendingSecret!)).toBe(result.secret);
      });

      it("replaces an earlier pending secret and leaves an enrolled one alone", async () => {
        const enrolled = encrypt(new Secret({ size: 20 }).base32);
        const user = await insertUser({ totpSecret: enrolled });
        const first = await service.startTotpEnrollment(user.id);

        const second = await service.startTotpEnrollment(user.id);

        const row = await stored(user.id);
        expect(second.secret).not.toBe(first.secret);
        expect(decrypt(row.totpPendingSecret!)).toBe(second.secret);
        expect(row.totpSecret).toBe(enrolled);
      });
    });

    describe("confirmTotpEnrollment", () => {
      it("enrolls with a REAL code from the secret start returned", async () => {
        const user = await insertUser();
        const started = await service.startTotpEnrollment(user.id);
        const pending = (await stored(user.id)).totpPendingSecret;

        await service.confirmTotpEnrollment(user.id, codeFor(started.secret));

        const row = await stored(user.id);
        expect(row.totpSecret).toBe(pending);
        expect(row.totpPendingSecret).toBeNull();
      });

      it("rejects a wrong code, keeps the pending secret, and enables nothing", async () => {
        const user = await insertUser();
        await service.startTotpEnrollment(user.id);
        const before = await stored(user.id);

        await expect(
          service.confirmTotpEnrollment(user.id, "000000"),
        ).rejects.toThrow(InvalidTotpCodeError);

        const after = await stored(user.id);
        expect(after.totpSecret).toBeNull();
        expect(after.totpPendingSecret).toBe(before.totpPendingSecret);
      });

      it("rejects confirm when start was never called", async () => {
        const user = await insertUser();

        await expect(
          service.confirmTotpEnrollment(user.id, "123456"),
        ).rejects.toThrow(TotpEnrollmentNotStartedError);
        expect((await stored(user.id)).totpSecret).toBeNull();
      });
    });

    describe("stepUpTotp", () => {
      it("signs a short-lived step-up token when the code matches", async () => {
        const secret = new Secret({ size: 20 }).base32;
        const user = await insertUser({ totpSecret: encrypt(secret) });

        const before = Date.now();
        const result = await service.stepUpTotp(user.id, codeFor(secret));

        // 5-minute TTL, measured from before the call.
        const ttl = result.expiresAt.getTime() - before;
        expect(ttl).toBeGreaterThanOrEqual(5 * 60_000);
        expect(ttl).toBeLessThan(5 * 60_000 + 1_000);
        const payload = await verifyAuthToken(result.token, {
          allowPurpose: ["session", "step_up"],
        });
        expect(payload.sub).toBe(user.id);
        expect(payload.provider).toBe("step_up");
        expect(payload.purpose).toBe("step_up");
      });

      it("rejects a wrong code with InvalidTotpCodeError", async () => {
        const user = await insertUser({
          totpSecret: encrypt(new Secret({ size: 20 }).base32),
        });

        await expect(service.stepUpTotp(user.id, "000000")).rejects.toThrow(
          InvalidTotpCodeError,
        );
      });

      it("rejects step-up for a user with no enrolled secret", async () => {
        const user = await insertUser();

        await expect(service.stepUpTotp(user.id, "123456")).rejects.toThrow(
          TotpNotEnrolledError,
        );
      });

      it("does not accept another user's secret", async () => {
        const secret = new Secret({ size: 20 }).base32;
        await insertUser({ email: "owner@example.com", totpSecret: encrypt(secret) });
        const other = await insertUser({
          email: "other@example.com",
          username: "other",
          totpSecret: encrypt(new Secret({ size: 20 }).base32),
        });

        await expect(
          service.stepUpTotp(other.id, codeFor(secret)),
        ).rejects.toThrow(InvalidTotpCodeError);
      });
    });

    it("reports a missing user as a 404, not a server error", async () => {
      const ghost = "00000000-0000-0000-0000-000000000000";

      for (const call of [
        () => service.startTotpEnrollment(ghost),
        () => service.confirmTotpEnrollment(ghost, "123456"),
        () => service.stepUpTotp(ghost, "123456"),
      ]) {
        await expect(call()).rejects.toMatchObject({
          status: 404,
          code: "USER_NOT_FOUND",
        });
      }
    });

    describe("hasTotpEnrolled", () => {
      it("is true only for the user who has a secret", async () => {
        const enrolled = await insertUser({
          email: "enrolled@example.com",
          totpSecret: encrypt(new Secret({ size: 20 }).base32),
        });
        const plain = await insertUser({ email: "plain@example.com", username: "plain" });

        expect(await service.hasTotpEnrolled(enrolled.id)).toBe(true);
        expect(await service.hasTotpEnrolled(plain.id)).toBe(false);
      });
    });
  });
});
