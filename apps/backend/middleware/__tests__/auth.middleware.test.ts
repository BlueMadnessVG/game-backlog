import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import {
  createAuthMiddleware,
  type CredentialType,
} from "../auth.middleware";
import type { AuthService } from "../../modules/auth/auth.services";
import { signAuthToken } from "../../lib/jwt.utils";
import { generateOpaqueToken } from "../../lib/api-token.utils";
import { SESSION_COOKIE_NAME } from "../../lib/session-cookie";

const makeApp = (
  token = { userId: "machine-1", scope: "read:library", tokenId: "tok-1" },
  opts?: { allowStepUp?: boolean },
) => {
  // Typed against the real method signature so `.mockResolvedValue` is
  // checked, while still being a plain vi.fn() at runtime.
  const verifyApiToken = vi.fn<AuthService["verifyApiToken"]>();
  verifyApiToken.mockResolvedValue(token);
  const authService = { verifyApiToken } as unknown as AuthService;

  const app = new Hono<{
    Variables: {
      userId: string;
      userEmail: string;
      credentialType: CredentialType;
      tokenScope: string;
      tokenPurpose: string;
    };
  }>();

  app.use("*", createAuthMiddleware(authService, opts));
  app.get("/protected", (c) =>
    c.json({
      userId: c.get("userId"),
      userEmail: c.get("userEmail") ?? null,
      credentialType: c.get("credentialType") ?? null,
      tokenScope: c.get("tokenScope") ?? null,
      tokenPurpose: c.get("tokenPurpose") ?? null,
    }),
  );
  app.post("/mutating", (c) => c.json({ ok: true }));
  app.delete("/auth/api-tokens/:id", (c) =>
    c.json({ ok: true, deleted: c.req.param("id") }),
  );

  return { app, verifyApiToken };
};

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENFORCE_API_TOKEN_SCOPES;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ENFORCE_API_TOKEN_SCOPES;
  });

  it("rejects requests without an Authorization header", async () => {
    const res = await makeApp().app.request("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed Authorization header", async () => {
    const res = await makeApp().app.request("/protected", {
      headers: { Authorization: "Basic abc" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await makeApp().app.request("/protected", {
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("passes a valid token and exposes the user", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "google",
    });

    const res = await makeApp().app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      userId: "user-1",
      userEmail: "user@example.com",
      credentialType: "session",
      tokenScope: null,
      tokenPurpose: "session",
    });
  });

  it("reports credentialType 'apiToken' and the verified scope", async () => {
    const { token } = generateOpaqueToken();
    const { app, verifyApiToken } = makeApp({
      userId: "machine-1",
      scope: "read:library",
      tokenId: "tok-1",
    });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(verifyApiToken).toHaveBeenCalledWith(token);
    expect(body).toEqual({
      userId: "machine-1",
      userEmail: null,
      credentialType: "apiToken",
      tokenScope: "read:library",
      tokenPurpose: null,
    });
  });

  it("rejects an API token that verifyApiToken does not recognise", async () => {
    const { token } = generateOpaqueToken();
    const { app, verifyApiToken } = makeApp();
    verifyApiToken.mockResolvedValue(null);

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    expect(await res.text()).toContain("SIGNAL_LOST");
  });

  it("reports credentialType 'session' for a cookie credential", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "google",
    });

    const { app } = makeApp();
    const res = await app.request("/protected", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.credentialType).toBe("session");
    expect(body.tokenScope).toBeNull();
  });

  it("requires X-Request-With for cookie-authenticated mutating requests", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "google",
    });

    const { app } = makeApp();

    const denied = await app.request("/mutating", {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(denied.status).toBe(403);

    const allowed = await app.request("/mutating", {
      method: "POST",
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        "X-Request-With": "1",
      },
    });
    expect(allowed.status).toBe(200);
  });

  describe("API token scope enforcement", () => {
    const bearer = (raw: { token: string }) => ({
      Authorization: `Bearer ${raw.token}`,
    });

    it("warns but does NOT deny a read:library token on a mutating method by default", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { token } = generateOpaqueToken();
      const { app } = makeApp();

      const res = await app.request("/mutating", {
        method: "POST",
        headers: bearer({ token }),
      });

      expect(res.status).toBe(200);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("[API_TOKEN_SCOPE] WARN-ONLY"),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("POST /mutating"),
      );
    });

    it("denies a read:library token on a mutating method when enforcement is on", async () => {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      const { token } = generateOpaqueToken();
      const { app } = makeApp();

      const res = await app.request("/mutating", {
        method: "POST",
        headers: bearer({ token }),
      });

      expect(res.status).toBe(403);
      expect(await res.text()).toContain("SCOPE_DENIED");
    });

    it("allows a write:library token on a mutating method under enforcement", async () => {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      const { token } = generateOpaqueToken();
      const { app } = makeApp({
        userId: "machine-1",
        scope: "write:library",
        tokenId: "tok-2",
      });

      const res = await app.request("/mutating", {
        method: "POST",
        headers: bearer({ token }),
      });

      expect(res.status).toBe(200);
    });

    it("always lets a token revoke its own token regardless of scope", async () => {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      const { token } = generateOpaqueToken();
      const { app } = makeApp();

      const res = await app.request("/auth/api-tokens/tok-1", {
        method: "DELETE",
        headers: bearer({ token }),
      });

      expect(res.status).toBe(200);
    });

    it("lets a read:library token read under enforcement", async () => {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      const { token } = generateOpaqueToken();
      const { app } = makeApp();

      const res = await app.request("/protected", {
        headers: bearer({ token }),
      });

      expect(res.status).toBe(200);
    });

    it("does not police session credentials by method", async () => {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      const jwt = await signAuthToken({
        sub: "user-1",
        email: "user@example.com",
        provider: "email",
      });

      const { app } = makeApp();
      const res = await app.request("/mutating", {
        method: "POST",
        headers: bearer({ token: jwt }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe("step-up purpose handling", () => {
    const stepUpJwt = () =>
      signAuthToken({
        sub: "user-1",
        email: "user@example.com",
        provider: "step_up",
        purpose: "step_up",
      });

    it("rejects a step-up JWT by default (purpose mismatch)", async () => {
      const jwt = await stepUpJwt();
      const { app } = makeApp();

      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      expect(res.status).toBe(401);
      expect(await res.text()).toContain("SIGNAL_LOST");
    });

    it("accepts a step-up JWT and exposes tokenPurpose when allowStepUp is set", async () => {
      const jwt = await stepUpJwt();
      const { app } = makeApp(undefined, { allowStepUp: true });

      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.credentialType).toBe("session");
      expect(body.tokenPurpose).toBe("step_up");
    });

    it("still accepts a normal session JWT under allowStepUp", async () => {
      const jwt = await signAuthToken({
        sub: "user-1",
        email: "user@example.com",
        provider: "email",
      });
      const { app } = makeApp(undefined, { allowStepUp: true });

      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.tokenPurpose).toBe("session");
    });
  });
});