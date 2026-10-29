import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAuthController } from "../auth.controller";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTotpCodeError,
  OAuthCallbackError,
  TotpEnrollmentNotStartedError,
  TotpNotEnrolledError,
} from "../auth.services";
import { authHeaders } from "../../../tests/auth.helpers";
import { signAuthToken } from "../../../lib/jwt.utils";
import { generateOpaqueToken } from "../../../lib/api-token.utils";

const makeMockAuthService = () => ({
  getUserById: vi.fn(),
  createAuthorizationUrl: vi.fn(),
  handleCallback: vi.fn(),
  getAvailableProviders: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  verifyApiToken: vi.fn(),
  hasTotpEnrolled: vi.fn(),
  createApiToken: vi.fn(),
  startTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  stepUpTotp: vi.fn(),
});

const makeUser = (overrides = {}) => ({
  id: "user-1",
  username: "testuser",
  email: "test@example.com",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("AuthController", () => {
  let authService: ReturnType<typeof makeMockAuthService>;
  let app: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    authService = makeMockAuthService();
    app = createAuthController(authService as never);
  });

  describe("GET /me", () => {
    it("returns 401 without a token", async () => {
      const res = await app.request("/me");
      expect(res.status).toBe(401);
    });

    it("returns the authenticated user", async () => {
      authService.getUserById.mockResolvedValue(makeUser());
      const headers = await authHeaders();

      const res = await app.request("/me", { headers });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.id).toBe("user-1");
      expect(body.data.email).toBe("test@example.com");
    });

    it("returns 404 when the user no longer exists", async () => {
      authService.getUserById.mockResolvedValue(null);
      const headers = await authHeaders();

      const res = await app.request("/me", { headers });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /providers", () => {
    it("returns the configured providers", async () => {
      authService.getAvailableProviders.mockReturnValue(["google", "discord"]);

      const res = await app.request("/providers");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.providers).toEqual(["google", "discord"]);
    });
  });

  describe("POST /register", () => {
    const payload = {
      username: "newbie",
      email: "new@example.com",
      password: "supersecret123",
    };

    it("creates the account and sets the session cookie", async () => {
      authService.register.mockResolvedValue({
        token: "signed-jwt",
        user: makeUser(),
        created: true,
      });

      const res = await app.request("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.created).toBe(true);
      expect(body.data.user.email).toBe("test@example.com");
      expect(body.data).not.toHaveProperty("token");
      expect(res.headers.get("set-cookie")).toContain(
        "backlog_session=signed-jwt",
      );
    });

    it("returns 400 for invalid input", async () => {
      const res = await app.request("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "", email: "not-an-email", password: "1" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when the email is already registered", async () => {
      authService.register.mockRejectedValue(
        new EmailAlreadyRegisteredError("Email is already registered"),
      );

      const res = await app.request("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: "ERROR",
        message: expect.any(String),
      });
    });
  });

  describe("POST /login", () => {
    const payload = {
      email: "test@example.com",
      password: "supersecret123",
    };

    it("sets the session cookie and keeps the token out of the body", async () => {
      authService.login.mockResolvedValue({
        token: "signed-jwt",
        user: makeUser(),
        created: false,
      });

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      const setCookie = res.headers.get("set-cookie") ?? "";

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.user.email).toBe("test@example.com");
      expect(body.data).not.toHaveProperty("token");
      expect(setCookie).toContain("backlog_session=signed-jwt");
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Secure/i);
      expect(setCookie).toMatch(/SameSite=None/i);
    });

    it("returns 401 for invalid credentials", async () => {
      authService.login.mockRejectedValue(
        new InvalidCredentialsError("Invalid email or password"),
      );

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe("Invalid email or password");
    });

    it("returns 400 for invalid input", async () => {
      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", password: "" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:provider", () => {
    it("redirects to the provider authorize URL", async () => {
      authService.createAuthorizationUrl.mockResolvedValue(
        new URL("https://accounts.google.com/o/oauth2/auth"),
      );

      const res = await app.request("/google");

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(
        "https://accounts.google.com/o/oauth2/auth",
      );
    });

    it("returns 400 for an unsupported provider", async () => {
      const res = await app.request("/myspace");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /:provider/callback", () => {
    it("sets the session cookie and redirects with no token in the URL", async () => {
      authService.handleCallback.mockResolvedValue({
        token: "signed-jwt",
        user: makeUser(),
        created: true,
      });

      const res = await app.request(
        "/google/callback?code=code-1&state=state-1",
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("location") ?? "";
      expect(location).toMatch(/\/auth\/callback$/);
      expect(location).not.toContain("signed-jwt");
      expect(res.headers.get("set-cookie")).toContain(
        "backlog_session=signed-jwt",
      );
    });

    it("redirects with invalid_state when the state is rejected", async () => {
      authService.handleCallback.mockRejectedValue(
        new OAuthCallbackError("Invalid or expired OAuth state"),
      );

      const res = await app.request(
        "/google/callback?code=code-1&state=bad-state",
      );

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("#error=invalid_state");
    });

    it("redirects with authentication_failed on other errors", async () => {
      authService.handleCallback.mockRejectedValue(
        new Error("provider exploded"),
      );

      const res = await app.request(
        "/google/callback?code=code-1&state=state-1",
      );

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain(
        "#error=authentication_failed",
      );
    });

    it("redirects with unsupported_provider for a bad provider", async () => {
      const res = await app.request(
        "/myspace/callback?code=code-1&state=state-1",
      );

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain(
        "#error=unsupported_provider",
      );
    });

    it("returns 400 when code or state is missing", async () => {
      const res = await app.request("/google/callback");
      expect(res.status).toBe(400);
    });
  });

  describe("POST /logout", () => {
    it("clears the cookie with the same Secure/SameSite attributes it was set with", async () => {
      const res = await app.request("/logout", { method: "POST" });
      const setCookie = res.headers.get("set-cookie") ?? "";

      expect(res.status).toBe(200);
      expect(setCookie).toContain("backlog_session=");
      expect(setCookie).toMatch(/Max-Age=0/i);
      expect(setCookie).toMatch(/Secure/i);
      expect(setCookie).toMatch(/SameSite=None/i);
      expect(setCookie).toMatch(/Path=\//i);
    });
  });

  describe("credential-sensitive routes", () => {
    const json = { "Content-Type": "application/json" };
    const apiTokenHeaders = () => ({
      ...json,
      Authorization: `Bearer ${generateOpaqueToken().token}`,
    });
    const sessionHeaders = async () => ({ ...json, ...(await authHeaders()) });
    const stepUpHeaders = async () => ({
      ...json,
      Authorization: `Bearer ${await signAuthToken(
        {
          sub: "test-user-1",
          email: "test@example.com",
          provider: "step_up",
          purpose: "step_up",
        },
        "5m",
      )}`,
    });

    // Every route that creates or changes a credential, with the service
    // method that must never run for an API-token caller.
    const routes = [
      {
        name: "POST /api-tokens",
        path: "/api-tokens",
        body: { name: "ci" },
        method: () => authService.createApiToken,
      },
      {
        name: "POST /totp/enroll/start",
        path: "/totp/enroll/start",
        body: {},
        method: () => authService.startTotpEnrollment,
      },
      {
        name: "POST /totp/enroll/confirm",
        path: "/totp/enroll/confirm",
        body: { code: "123456" },
        method: () => authService.confirmTotpEnrollment,
      },
      {
        name: "POST /step-up",
        path: "/step-up",
        body: { code: "123456" },
        method: () => authService.stepUpTotp,
      },
    ];

    beforeEach(() => {
      authService.verifyApiToken.mockResolvedValue({
        userId: "test-user-1",
        scope: "read:library",
        tokenId: "tok-1",
      });
      authService.hasTotpEnrolled.mockResolvedValue(false);
    });

    describe.each(routes)("$name", ({ path, body, method }) => {
      it("rejects an API token with 403 and never reaches the service", async () => {
        const res = await app.request(path, {
          method: "POST",
          headers: apiTokenHeaders(),
          body: JSON.stringify(body),
        });

        expect(res.status).toBe(403);
        expect(await res.text()).toContain("SESSION_REQUIRED");
        expect(method()).not.toHaveBeenCalled();
      });

      it("rejects an unauthenticated request with 401", async () => {
        const res = await app.request(path, {
          method: "POST",
          headers: json,
          body: JSON.stringify(body),
        });

        expect(res.status).toBe(401);
        expect(method()).not.toHaveBeenCalled();
      });
    });

    it("a leaked API token cannot chain enroll -> step-up -> mint", async () => {
      // The attack this module exists to stop, end to end: even if each
      // service call WOULD succeed, the token never gets past the first gate.
      authService.startTotpEnrollment.mockResolvedValue({
        secret: "S",
        otpauthUrl: "otpauth://x",
      });
      authService.stepUpTotp.mockResolvedValue({
        token: "step-up-jwt",
        expiresAt: new Date(),
      });
      authService.createApiToken.mockResolvedValue({
        id: "t",
        token: "bkl_x",
        tokenPrefix: "bkl_x",
      });

      const headers = apiTokenHeaders();
      const steps = [
        ["/totp/enroll/start", {}],
        ["/step-up", { code: "123456" }],
        ["/api-tokens", { name: "child" }],
      ] as const;

      for (const [path, body] of steps) {
        const res = await app.request(path, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(403);
      }
      expect(authService.createApiToken).not.toHaveBeenCalled();
    });

    describe("POST /api-tokens", () => {
      const mint = (headers: Record<string, string>) =>
        app.request("/api-tokens", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "ci" }),
        });

      beforeEach(() => {
        authService.createApiToken.mockResolvedValue({
          id: "tok-2",
          token: "bkl_secret",
          tokenPrefix: "bkl_secr",
        });
      });

      it("mints for a non-enrolled user on a plain session", async () => {
        const res = await mint(await sessionHeaders());

        expect(res.status).toBe(201);
        expect(authService.createApiToken).toHaveBeenCalledWith(
          "test-user-1",
          expect.objectContaining({
            name: "ci",
            audit: expect.objectContaining({ triggeredBy: "session" }),
          }),
        );
      });

      it("demands step-up from an enrolled user on a plain session", async () => {
        authService.hasTotpEnrolled.mockResolvedValue(true);

        const res = await mint(await sessionHeaders());

        expect(res.status).toBe(403);
        expect(await res.text()).toContain("STEP_UP_REQUIRED");
        expect(authService.createApiToken).not.toHaveBeenCalled();
      });

      it("mints for an enrolled user with a step-up token", async () => {
        authService.hasTotpEnrolled.mockResolvedValue(true);

        const res = await mint(await stepUpHeaders());

        expect(res.status).toBe(201);
        expect(authService.createApiToken).toHaveBeenCalledTimes(1);
      });
    });

    describe("POST /totp/enroll/start", () => {
      const start = (headers: Record<string, string>) =>
        app.request("/totp/enroll/start", { method: "POST", headers });

      it("returns the secret and otpauth URL", async () => {
        authService.startTotpEnrollment.mockResolvedValue({
          secret: "JBSWY3DPEHPK3PXP",
          otpauthUrl: "otpauth://totp/game-backlog:test",
        });

        const res = await start(await sessionHeaders());
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.data.secret).toBe("JBSWY3DPEHPK3PXP");
        expect(authService.startTotpEnrollment).toHaveBeenCalledWith(
          "test-user-1",
        );
      });

      it("demands step-up before an enrolled user can start a rotation", async () => {
        authService.hasTotpEnrolled.mockResolvedValue(true);

        const res = await start(await sessionHeaders());

        expect(res.status).toBe(403);
        expect(await res.text()).toContain("STEP_UP_REQUIRED");
        expect(authService.startTotpEnrollment).not.toHaveBeenCalled();
      });
    });

    describe("POST /totp/enroll/confirm", () => {
      const confirm = async (code = "123456") =>
        app.request("/totp/enroll/confirm", {
          method: "POST",
          headers: await sessionHeaders(),
          body: JSON.stringify({ code }),
        });

      it("enables TOTP when the code verifies", async () => {
        authService.confirmTotpEnrollment.mockResolvedValue(undefined);

        const res = await confirm();

        expect(res.status).toBe(200);
        expect(authService.confirmTotpEnrollment).toHaveBeenCalledWith(
          "test-user-1",
          "123456",
        );
      });

      it("returns 400 for a wrong code", async () => {
        authService.confirmTotpEnrollment.mockRejectedValue(
          new InvalidTotpCodeError("TOTP code did not verify"),
        );
        expect((await confirm("000000")).status).toBe(400);
      });

      it("returns 400 when enrollment was never started", async () => {
        authService.confirmTotpEnrollment.mockRejectedValue(
          new TotpEnrollmentNotStartedError("not started"),
        );
        expect((await confirm()).status).toBe(400);
      });

      it("returns 400 for a malformed code", async () => {
        expect((await confirm("12")).status).toBe(400);
        expect(authService.confirmTotpEnrollment).not.toHaveBeenCalled();
      });
    });

    describe("POST /step-up", () => {
      const stepUp = async () =>
        app.request("/step-up", {
          method: "POST",
          headers: await sessionHeaders(),
          body: JSON.stringify({ code: "123456" }),
        });

      it("returns a step-up token for a valid code", async () => {
        authService.stepUpTotp.mockResolvedValue({
          token: "step-up-jwt",
          expiresAt: new Date("2026-01-01T00:05:00Z"),
        });

        const res = await stepUp();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.token).toBe("step-up-jwt");
      });

      it("returns 400 for a wrong code", async () => {
        authService.stepUpTotp.mockRejectedValue(
          new InvalidTotpCodeError("TOTP code did not verify"),
        );
        expect((await stepUp()).status).toBe(400);
      });

      it("returns 400 when the user has no enrolled secret", async () => {
        authService.stepUpTotp.mockRejectedValue(
          new TotpNotEnrolledError("not enrolled"),
        );
        expect((await stepUp()).status).toBe(400);
      });
    });
  });
});
