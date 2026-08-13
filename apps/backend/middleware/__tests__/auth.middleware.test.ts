import { describe, it, expect } from "vitest";
import { Hono } from "hono";

import { authMiddleware } from "../auth.middleware";
import { signAuthToken } from "../../lib/jwt.utils";

const makeApp = () => {
  const app = new Hono<{
    Variables: { userId: string; userEmail: string };
  }>();

  app.use("*", authMiddleware);
  app.get("/protected", (c) =>
    c.json({ userId: c.get("userId"), userEmail: c.get("userEmail") }),
  );

  return app;
};

describe("authMiddleware", () => {
  it("rejects requests without an Authorization header", async () => {
    const res = await makeApp().request("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed Authorization header", async () => {
    const res = await makeApp().request("/protected", {
      headers: { Authorization: "Basic abc" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await makeApp().request("/protected", {
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

    const res = await makeApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ userId: "user-1", userEmail: "user@example.com" });
  });
});
