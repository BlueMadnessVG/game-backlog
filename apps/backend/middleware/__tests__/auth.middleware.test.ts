import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import {
  createAuthMiddleware,
  type CredentialType,
} from "../auth.middleware";
import type { AuthService } from "../../modules/auth/auth.services";
import { signAuthToken } from "../../lib/jwt.utils";
import { generateOpaqueToken } from "../../lib/api-token.utils";
import { SESSION_COOKIE_NAME } from "../../lib/session-cookie";

const makeApp = () => {
  // Typed against the real method signature so `.mockResolvedValue` is
  // checked, while still being a plain vi.fn() at runtime.
  const verifyApiToken = vi.fn<AuthService["verifyApiToken"]>();
  const authService = { verifyApiToken } as unknown as AuthService;

  const app = new Hono<{
    Variables: {
      userId: string;
      userEmail: string;
      credentialType: CredentialType;
    };
  }>();

  app.use("*", createAuthMiddleware(authService));
  app.get("/protected", (c) =>
    c.json({
      userId: c.get("userId"),
      userEmail: c.get("userEmail") ?? null,
      credentialType: c.get("credentialType") ?? null,
    }),
  );
  app.post("/mutating", (c) => c.json({ ok: true }));

  return { app, verifyApiToken };
};

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });
  });

  it("reports credentialType 'apiToken' for a bkl_ bearer token", async () => {
    const { token } = generateOpaqueToken();
    const { app, verifyApiToken } = makeApp();
    verifyApiToken.mockResolvedValue({ userId: "machine-1" });

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
});
