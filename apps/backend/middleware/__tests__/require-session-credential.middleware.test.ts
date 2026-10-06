import { describe, it, expect } from "vitest";
import { Hono } from "hono";

import { createRequireSessionCredentialMiddleware } from "../require-session-credential.middleware";
import type { CredentialType } from "../auth.middleware";

const makeApp = () => {
  const app = new Hono<{
    Variables: { userId: string; credentialType: CredentialType };
  }>();

  // Stands in for createAuthMiddleware, which must run first and is what
  // populates userId + credentialType. Both are only ever set together by
  // the real middleware, so this mirrors that coupling.
  app.use("*", async (c, next) => {
    const userId = c.req.header("X-Test-User");
    if (userId) {
      c.set("userId", userId);
      const kind = c.req.header("X-Test-Credential");
      if (kind === "session" || kind === "apiToken") {
        c.set("credentialType", kind);
      }
    }
    await next();
  });

  app.get(
    "/guarded",
    createRequireSessionCredentialMiddleware(),
    (c) => c.json({ ok: true, userId: c.get("userId") }),
  );

  return app;
};

describe("createRequireSessionCredentialMiddleware", () => {
  it("rejects a missing userId with 401 (auth middleware was never mounted)", async () => {
    const res = await makeApp().request("/guarded");
    expect(res.status).toBe(401);
  });

  it("rejects 401 when userId is present but credentialType was never set", async () => {
    const res = await makeApp().request("/guarded", {
      headers: { "X-Test-User": "user-1" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an API token with 403, not 401", async () => {
    const res = await makeApp().request("/guarded", {
      headers: { "X-Test-User": "user-1", "X-Test-Credential": "apiToken" },
    });
    expect(res.status).toBe(403);
  });

  it("returns the same error message whatever the API token claims", async () => {
    const res = await makeApp().request("/guarded", {
      headers: { "X-Test-User": "user-1", "X-Test-Credential": "apiToken" },
    });
    expect(await res.text()).toContain("SESSION_REQUIRED");
  });

  it("allows a session credential through", async () => {
    const res = await makeApp().request("/guarded", {
      headers: { "X-Test-User": "user-1", "X-Test-Credential": "session" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: "user-1" });
  });
});
