import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAuthController } from "../auth.controller";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  OAuthCallbackError,
} from "../auth.services";
import { authHeaders } from "../../../tests/auth.helpers";

const makeMockAuthService = () => ({
  getUserById: vi.fn(),
  createAuthorizationUrl: vi.fn(),
  handleCallback: vi.fn(),
  getAvailableProviders: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
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

    it("creates the account and returns a token", async () => {
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

    it("returns a token for valid credentials", async () => {
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

      expect(res.status).toBe(200);
      expect(body.status).toBe("SUCCESS");
      expect(body.data.token).toBe("signed-jwt");
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
    it("redirects to the frontend with the token fragment", async () => {
      authService.handleCallback.mockResolvedValue({
        token: "signed-jwt",
        user: makeUser(),
        created: true,
      });

      const res = await app.request(
        "/google/callback?code=code-1&state=state-1",
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("#token=signed-jwt");
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
});
