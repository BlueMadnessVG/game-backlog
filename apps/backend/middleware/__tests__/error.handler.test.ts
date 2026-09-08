import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { errorHandler } from "../error.handler";

const makeApp = (): Hono => {
  const app = new Hono();

  app.get("/boom", () => {
    throw new Error("boom");
  });

  app.get("/validation", () => {
    throw Object.assign(new Error("schema mismatch"), { name: "ValidError" });
  });

  app.get("/http", () => {
    throw new HTTPException(409, { message: "conflict" });
  });

  app.onError(errorHandler);

  return app;
};

afterEach(() => {
  delete process.env.APP_ENV;
});

describe("errorHandler", () => {
  it("returns 500 for an unhandled server error", async () => {
    const res = await makeApp().request("/boom");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Internal Command Center Failure" });
    expect(body.message).toBe("Unknown Error");
  });

  it("hides the error message outside development", async () => {
    process.env.APP_ENV = "production";
    const res = await makeApp().request("/boom");

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.message).toBe("Unknown Error");
    expect(body.message).not.toBe("boom");
  });

  it("reveals the error message in development", async () => {
    process.env.APP_ENV = "development";
    const res = await makeApp().request("/boom");

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.message).toBe("boom");
  });

  it("returns 400 for a validation error", async () => {
    const res = await makeApp().request("/validation");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Failed");
  });

  it("passes HTTPExceptions through with their status", async () => {
    const res = await makeApp().request("/http");

    expect(res.status).toBe(409);
    expect(await res.text()).toBe("conflict");
  });
});