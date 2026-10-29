import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

import {
  requireCredential,
  type CredentialPolicy,
} from "../credential-policy.middleware";
import type { AuthService } from "../../modules/auth/auth.services";
import { signAuthToken } from "../../lib/jwt.utils";
import { generateOpaqueToken } from "../../lib/api-token.utils";

const makeApp = (
  policy: CredentialPolicy,
  { enrolled = false }: { enrolled?: boolean } = {},
) => {
  const verifyApiToken = vi.fn<AuthService["verifyApiToken"]>();
  verifyApiToken.mockResolvedValue({
    userId: "user-1",
    scope: "read:library",
    tokenId: "tok-1",
  });
  const hasTotpEnrolled = vi.fn<AuthService["hasTotpEnrolled"]>();
  hasTotpEnrolled.mockResolvedValue(enrolled);
  const authService = {
    verifyApiToken,
    hasTotpEnrolled,
  } as unknown as AuthService;

  const app = new Hono();
  app.get("/guarded", requireCredential(authService, policy), (c) =>
    c.json({ ok: true }),
  );
  app.get("/boom", requireCredential(authService, policy), () => {
    throw new Error("handler exploded");
  });

  return { app, hasTotpEnrolled, verifyApiToken };
};

const sessionJwt = () =>
  signAuthToken({ sub: "user-1", email: "u@example.com", provider: "email" });

const stepUpJwt = () =>
  signAuthToken(
    {
      sub: "user-1",
      email: "u@example.com",
      provider: "step_up",
      purpose: "step_up",
    },
    "5m",
  );

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const apiToken = () => bearer(generateOpaqueToken().token);

describe("requireCredential", () => {
  describe("credential: session", () => {
    const policy: CredentialPolicy = { credential: "session" };

    it("allows a session JWT", async () => {
      const { app } = makeApp(policy);
      const res = await app.request("/guarded", {
        headers: bearer(await sessionJwt()),
      });
      expect(res.status).toBe(200);
    });

    it("rejects an API token with 403 SESSION_REQUIRED, not 401", async () => {
      const { app } = makeApp(policy);
      const res = await app.request("/guarded", { headers: apiToken() });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("SESSION_REQUIRED");
    });

    it("rejects a request with no credential with 401", async () => {
      const { app } = makeApp(policy);
      const res = await app.request("/guarded");
      expect(res.status).toBe(401);
    });

    it("rejects a revoked or unknown API token with 401, not 403", async () => {
      const { app, verifyApiToken } = makeApp(policy);
      verifyApiToken.mockResolvedValue(null);
      const res = await app.request("/guarded", { headers: apiToken() });
      expect(res.status).toBe(401);
    });
  });

  describe("credential: any", () => {
    it("allows an API token", async () => {
      const { app } = makeApp({ credential: "any" });
      const res = await app.request("/guarded", { headers: apiToken() });
      expect(res.status).toBe(200);
    });
  });

  describe("stepUp: never (default)", () => {
    it("rejects a step-up JWT, as every non-mint route does", async () => {
      const { app } = makeApp({ credential: "session" });
      const res = await app.request("/guarded", {
        headers: bearer(await stepUpJwt()),
      });
      expect(res.status).toBe(401);
    });

    it("does not look up TOTP enrollment", async () => {
      const { app, hasTotpEnrolled } = makeApp({ credential: "session" });
      await app.request("/guarded", { headers: bearer(await sessionJwt()) });
      expect(hasTotpEnrolled).not.toHaveBeenCalled();
    });
  });

  describe("stepUp: if-enrolled", () => {
    const policy: CredentialPolicy = {
      credential: "session",
      stepUp: "if-enrolled",
    };

    it("lets a non-enrolled user through on a plain session", async () => {
      const { app } = makeApp(policy, { enrolled: false });
      const res = await app.request("/guarded", {
        headers: bearer(await sessionJwt()),
      });
      expect(res.status).toBe(200);
    });

    it("demands step-up from an enrolled user on a plain session", async () => {
      const { app } = makeApp(policy, { enrolled: true });
      const res = await app.request("/guarded", {
        headers: bearer(await sessionJwt()),
      });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("STEP_UP_REQUIRED");
    });

    it("lets an enrolled user through with a step-up JWT", async () => {
      const { app } = makeApp(policy, { enrolled: true });
      const res = await app.request("/guarded", {
        headers: bearer(await stepUpJwt()),
      });
      expect(res.status).toBe(200);
    });

    it("rejects an API token as SESSION_REQUIRED before any enrollment lookup", async () => {
      const { app, hasTotpEnrolled } = makeApp(policy, { enrolled: true });
      const res = await app.request("/guarded", { headers: apiToken() });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("SESSION_REQUIRED");
      expect(hasTotpEnrolled).not.toHaveBeenCalled();
    });
  });

  describe("errors thrown after the policy passes", () => {
    it("are not rewritten as 401 by the authentication step", async () => {
      const { app } = makeApp({ credential: "session" });
      const res = await app.request("/boom", {
        headers: bearer(await sessionJwt()),
      });
      expect(res.status).toBe(500);
    });
  });
});
