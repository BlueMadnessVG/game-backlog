import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

import { createRequireAdminMiddleware } from "../require-admin.middleware";

/**
 * Minimal chainable mock — the middleware only ever issues
 * select().from().where().limit(), matching the style used by
 * auth.services.test.ts's makeMockDb.
 */
const makeMockDb = (role: "user" | "admin" | undefined) => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(role ? [{ role }] : []),
});

const makeApp = (db: ReturnType<typeof makeMockDb>) => {
  const app = new Hono<{ Variables: { userId: string } }>();

  // Stands in for createAuthMiddleware, which must run first to set userId.
  app.use("*", async (c, next) => {
    const userId = c.req.header("X-Test-User");
    if (userId) c.set("userId", userId);
    await next();
  });

  app.get(
    "/admin",
    createRequireAdminMiddleware(db as never),
    (c) => c.json({ ok: true, userId: c.get("userId") }),
  );

  return app;
};

describe("createRequireAdminMiddleware", () => {
  it("rejects a missing userId with 401 (fails closed when auth middleware is not mounted)", async () => {
    const res = await makeApp(makeMockDb("admin")).request("/admin");
    expect(res.status).toBe(401);
  });

  it("rejects a non-admin user with 403", async () => {
    const res = await makeApp(makeMockDb("user")).request("/admin", {
      headers: { "X-Test-User": "user-1" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects when the user row cannot be found", async () => {
    const res = await makeApp(makeMockDb(undefined)).request("/admin", {
      headers: { "X-Test-User": "ghost-1" },
    });
    expect(res.status).toBe(403);
  });

  it("allows an admin through", async () => {
    const res = await makeApp(makeMockDb("admin")).request("/admin", {
      headers: { "X-Test-User": "admin-1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: "admin-1" });
  });
});