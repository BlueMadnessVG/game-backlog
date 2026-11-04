import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { createAuthMiddleware } from "../auth.middleware";
import { errorHandler, notFoundHandler } from "../error.handler";
import { signAuthToken } from "../../lib/jwt.utils";
import { generateOpaqueToken } from "../../lib/api-token.utils";
import { ValidationError } from "../../lib/errors";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from "../../lib/provider-error.utils";
import {
  AccountNotLinkedError,
  GameNotFoundError,
  LinkFailedError,
  RelinkRequiredError,
} from "../../modules/platforms/errors";

// The error handler is only useful if errors actually reach it, so these tests
// build the app the way index.ts does: root app -> /api/v1 -> a controller
// that has the auth middleware on "*". Unit tests of the handler alone can't
// catch an error being swallowed or rewritten on the way.

const authService = {
  verifyApiToken: async () => ({ userId: "u1", scope: "read:library", tokenId: "t1" }),
};

const buildApp = (thrower: () => unknown) => {
  const controller = new Hono();
  controller.use("*", createAuthMiddleware(authService as never));
  controller.get("/boom", () => {
    throw thrower();
  });
  controller.post("/boom", () => {
    throw thrower();
  });

  const api = new Hono();
  api.route("/steam", controller);

  const app = new Hono();
  app.use("*", requestId());
  app.route("/api/v1", api);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
};

let sessionHeaders: Record<string, string>;
const apiTokenHeaders = () => ({ Authorization: `Bearer ${generateOpaqueToken().token}` });

beforeAll(async () => {
  const jwt = await signAuthToken({ sub: "u1", email: "u@example.com", provider: "email" });
  sessionHeaders = { Authorization: `Bearer ${jwt}` };
});

afterEach(() => vi.restoreAllMocks());

const credentials = [
  ["a session", () => sessionHeaders],
  ["an API token", apiTokenHeaders],
] as const;

describe.each(credentials)("an error thrown by a handler behind auth, for %s", (_name, headers) => {
  const hit = async (thrower: () => unknown) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await buildApp(thrower).request("/api/v1/steam/boom", { headers: headers() });
    return { res, body: await res.json() };
  };

  it("keeps a domain error's own status and code", async () => {
    const { res, body } = await hit(() => new GameNotFoundError("g1"));

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ status: "ERROR", code: "GAME_NOT_FOUND" });
  });

  it("reports a platform rate limit as 503 with Retry-After", async () => {
    const { res, body } = await hit(() => new ProviderRateLimitError("SteamProvider"));

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(body.code).toBe("PROVIDER_RATE_LIMITED");
  });

  it("reports validation problems as 400 with the issues", async () => {
    const { res, body } = await hit(
      () => new ValidationError("filter is invalid", [{ path: "filter", message: "filter is invalid" }]),
    );

    expect(res.status).toBe(400);
    expect(body.issues).toEqual([{ path: "filter", message: "filter is invalid" }]);
  });

  it("turns a bug into a generic 500 with a request id", async () => {
    const { res, body } = await hit(() => new Error("db exploded"));

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ status: "ERROR", code: "INTERNAL_ERROR" });
    expect(body.requestId).toBe(res.headers.get("X-Request-Id"));
  });

  // The frontend clears the session on a 401. None of these may produce one,
  // wherever in the stack they are thrown.
  it.each([
    ["a platform rejecting our key", () => new ProviderAuthError("SteamProvider")],
    ["a platform being down", () => new ProviderUnavailableError("SteamProvider", "HTTP 500")],
    ["a bad NPSSO", () => new LinkFailedError("NPSSO rejected")],
    ["a revoked refresh token", () => new RelinkRequiredError("playstation")],
    ["no account linked", () => new AccountNotLinkedError("steam")],
  ])("never turns %s into a 401", async (_label, thrower) => {
    const { res } = await hit(thrower);

    expect(res.status).not.toBe(401);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("the other ways a request fails", () => {
  const app = () => buildApp(() => new Error("unused"));

  it("answers an unknown route with the same JSON shape", async () => {
    const res = await app().request("/api/v1/steam/nope", { headers: sessionHeaders });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ status: "ERROR", code: "ROUTE_NOT_FOUND" });
  });

  it("answers a missing credential with a JSON 401 and a code", async () => {
    const res = await app().request("/api/v1/steam/boom");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ status: "ERROR", code: "MISSING_COORDINATES" });
  });

  it("answers a bad token with a JSON 401", async () => {
    const res = await app().request("/api/v1/steam/boom", {
      headers: { Authorization: "Bearer not-a-valid-token" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ status: "ERROR", code: "SIGNAL_LOST" });
  });

  it("answers a cookie-authenticated write without the CSRF header with a JSON 403", async () => {
    const jwt = sessionHeaders.Authorization!.replace("Bearer ", "");
    const res = await app().request("/api/v1/steam/boom", {
      method: "POST",
      headers: { Cookie: `backlog_session=${jwt}` },
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "ERROR", code: "CSRF_CHECK_FAILED" });
  });
});
