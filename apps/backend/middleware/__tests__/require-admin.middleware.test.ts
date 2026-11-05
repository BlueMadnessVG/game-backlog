import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";

import { createRequireAdminMiddleware } from "../require-admin.middleware";
import { users } from "../../db/schema";
import { createTestDb, type TestDb } from "../../tests/test-db";
import { withErrorHandling } from "../../tests/auth.helpers";

describe("createRequireAdminMiddleware (real database)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const makeUser = async (role: "user" | "admin", name: string) => {
    const [user] = await t.db
      .insert(users)
      .values({ username: name, email: `${name}@example.com`, role })
      .returning({ id: users.id });
    return user!.id;
  };

  const makeApp = () => {
    const app = new Hono<{ Variables: { userId: string } }>();

    // Stands in for createAuthMiddleware, which must run first to set userId.
    app.use("*", async (c, next) => {
      const userId = c.req.header("X-Test-User");
      if (userId) c.set("userId", userId);
      await next();
    });

    app.get("/admin", createRequireAdminMiddleware(t.db), (c) =>
      c.json({ ok: true, userId: c.get("userId") }),
    );

    return withErrorHandling(app);
  };

  const asUser = (userId?: string) =>
    makeApp().request("/admin", {
      headers: userId ? { "X-Test-User": userId } : {},
    });

  it("rejects a missing userId with 401 (fails closed when auth middleware is not mounted)", async () => {
    await makeUser("admin", "root");

    expect((await asUser()).status).toBe(401);
  });

  it("rejects a non-admin user with 403", async () => {
    const user = await makeUser("user", "plain");

    expect((await asUser(user)).status).toBe(403);
  });

  it("rejects a regular user even while an admin exists", async () => {
    // Only a real WHERE can tell the two rows apart: it must look up the
    // requesting user's role, not just any user's.
    await makeUser("admin", "root");
    const user = await makeUser("user", "plain");

    expect((await asUser(user)).status).toBe(403);
  });

  it("rejects when the user row cannot be found", async () => {
    await makeUser("admin", "root");

    const res = await asUser("00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(403);
  });

  it("allows an admin through", async () => {
    const admin = await makeUser("admin", "root");
    await makeUser("user", "plain");

    const res = await asUser(admin);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: admin });
  });

  it("takes effect on the next request when a role changes", async () => {
    const { eq } = await import("drizzle-orm");
    const admin = await makeUser("admin", "root");
    expect((await asUser(admin)).status).toBe(200);

    await t.db.update(users).set({ role: "user" }).where(eq(users.id, admin));

    expect((await asUser(admin)).status).toBe(403);
  });
});
