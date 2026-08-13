import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthService, OAuthCallbackError } from "../auth.services";
import { oauthStateStore } from "../auth.state";
import { verifyAuthToken } from "../../../lib/jwt.utils";

const makeMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
});

const makeMockProvider = () => ({
  createAuthorizationUrl: vi.fn(),
  validateAuthorizationCode: vi.fn(),
});

const makeUser = (overrides = {}) => ({
  id: "user-uuid-1",
  username: "testuser",
  email: "test@example.com",
  avatarUrl: null,
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
});
