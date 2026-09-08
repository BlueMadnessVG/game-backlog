import { describe, it, expect } from "vitest";
import { Hono } from "hono";

import { corsMiddleware } from "../cors.middleware";

const makeApp = (): Hono => {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/data", (c) => c.json({ ok: true }));
  return app;
};

describe("corsMiddleware", () => {
  it("allows localhost origins", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("allows Tauri origins", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "tauri://localhost" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "tauri://localhost",
    );
  });

  it("allows Tauri origins case-insensitively", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "TAURI://LOCALHOST" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "TAURI://LOCALHOST",
    );
  });

  it("allows IPC origins", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "ipc://localhost" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "ipc://localhost",
    );
  });

  it("rejects unknown origins by omitting the allow-origin header", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "https://evil.example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not mistake a lookalike host for localhost", async () => {
    const res = await makeApp().request("http://localhost/data", {
      headers: { Origin: "http://localhost.evil.example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers preflight OPTIONS for an allowed origin", async () => {
    const res = await makeApp().request("http://localhost/preflight", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });
});