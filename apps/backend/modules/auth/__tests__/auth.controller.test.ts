import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAuthController } from "../auth.controller";
import { OAuthCallbackError } from "../auth.services";
import { authHeaders } from "../../../tests/auth.helpers";

const makeMockAuthService = () => ({
  getUserById: vi.fn(),
  createAuthorizationUrl: vi.fn(),
  handleCallback: vi.fn(),
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
