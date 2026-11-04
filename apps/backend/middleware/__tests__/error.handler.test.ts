import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";

import { errorHandler, notFoundHandler } from "../error.handler";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors";
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
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTotpCodeError,
  OAuthCallbackError,
  TotpEnrollmentNotStartedError,
  TotpNotEnrolledError,
} from "../../modules/auth/auth.services";

// One mapping from "what went wrong" to "what the client sees". These tests
// go through a real Hono app so the handler is exercised the way it runs.

const makeApp = (thrower: () => unknown): Hono => {
  const app = new Hono();
  app.use("*", requestId());
  app.get("/x", () => {
    throw thrower();
  });
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
};

const call = async (thrower: () => unknown) => {
  const res = await makeApp(thrower).request("/x");
  return { res, body: await res.json() };
};

// Server errors are logged on purpose; keep that out of the test output.
// (Tests that assert on the log re-spy and get this same spy.)
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.APP_ENV;
  vi.restoreAllMocks();
});

describe("errorHandler", () => {
  // Every domain error: where it goes over HTTP. This table IS the API's
  // error contract, so changing a row is a deliberate decision.
  describe("domain errors", () => {
    it.each([
      ["GameNotFoundError", 404, "GAME_NOT_FOUND", () => new GameNotFoundError("g1")],
      ["AccountNotLinkedError", 409, "ACCOUNT_NOT_LINKED", () => new AccountNotLinkedError("steam")],
      ["LinkFailedError", 422, "LINK_FAILED", () => new LinkFailedError("Could not find Steam profile")],
      ["RelinkRequiredError", 409, "RELINK_REQUIRED", () => new RelinkRequiredError("playstation")],
      ["ProviderUnavailableError", 502, "PROVIDER_UNAVAILABLE", () => new ProviderUnavailableError("SteamProvider", "HTTP 500")],
      ["ProviderAuthError", 502, "PROVIDER_AUTH_FAILED", () => new ProviderAuthError("SteamProvider")],
      ["ProviderRateLimitError", 503, "PROVIDER_RATE_LIMITED", () => new ProviderRateLimitError("SteamProvider")],
      ["EmailAlreadyRegisteredError", 409, "EMAIL_TAKEN", () => new EmailAlreadyRegisteredError("taken")],
      ["InvalidCredentialsError", 401, "INVALID_CREDENTIALS", () => new InvalidCredentialsError("Invalid email or password")],
      ["InvalidTotpCodeError", 400, "INVALID_TOTP_CODE", () => new InvalidTotpCodeError("bad code")],
      ["TotpNotEnrolledError", 400, "TOTP_NOT_ENROLLED", () => new TotpNotEnrolledError("not enrolled")],
      ["TotpEnrollmentNotStartedError", 400, "TOTP_ENROLLMENT_NOT_STARTED", () => new TotpEnrollmentNotStartedError("not started")],
      ["OAuthCallbackError", 400, "OAUTH_STATE_INVALID", () => new OAuthCallbackError("stale state")],
      ["NotFoundError", 404, "USER_NOT_FOUND", () => new NotFoundError("USER_NOT_FOUND", "User not found")],
      ["ValidationError", 400, "VALIDATION_FAILED", () => new ValidationError("bad input")],
    ])("%s -> %i %s", async (_name, status, code, thrower) => {
      const { res, body } = await call(thrower);

      expect(res.status).toBe(status);
      expect(body).toMatchObject({ status: "ERROR", code, message: expect.any(String) });
    });

    it("every AppError carries a status and a SCREAMING_SNAKE_CASE code", () => {
      const samples: AppError[] = [
        new GameNotFoundError("g"), new AccountNotLinkedError("steam"), new LinkFailedError("x"),
        new RelinkRequiredError("psn"), new ProviderUnavailableError("p", "m"),
        new ProviderAuthError("p"), new ProviderRateLimitError("p"),
        new EmailAlreadyRegisteredError("m"), new InvalidCredentialsError("m"),
      ];
      for (const e of samples) {
        expect(e.status).toBeGreaterThanOrEqual(400);
        expect(e.code).toMatch(/^[A-Z][A-Z0-9_]+$/);
      }
    });

    it("sends Retry-After with a platform rate limit", async () => {
      const { res } = await call(() => new ProviderRateLimitError("SteamProvider"));

      expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("includes the validation issues", async () => {
      const { body } = await call(
        () => new ValidationError("Email is required", [{ path: "email", message: "Email is required" }]),
      );

      expect(body.issues).toEqual([{ path: "email", message: "Email is required" }]);
    });

    it("shows the client a fixed sentence for provider failures, never the raw detail", async () => {
      const { body } = await call(
        () => new ProviderUnavailableError("SteamProvider", "HTTP 500: Internal Server Error at key=abc123"),
      );

      expect(body.message).toBe("The game platform is temporarily unavailable. Try again later.");
      expect(JSON.stringify(body)).not.toMatch(/SteamProvider|abc123|HTTP 500/);
    });

    it("uses the friendly public message for a taken email", async () => {
      const { body } = await call(() => new EmailAlreadyRegisteredError("Email is already registered"));

      expect(body.message).toBe("This email is already registered. Sign in or use a different account.");
    });

    // The frontend clears the session on any 401, so a failure that is not
    // about the user's own session must never be a 401.
    it("only maps the user's own bad credentials to 401, never a platform failure", async () => {
      const platformFailures = [
        new ProviderAuthError("SteamProvider"),
        new ProviderUnavailableError("XboxProvider", "down"),
        new ProviderRateLimitError("PsnProvider"),
        new LinkFailedError("NPSSO rejected"),
        new RelinkRequiredError("playstation"),
        new AccountNotLinkedError("xbox"),
      ];
      for (const error of platformFailures) {
        expect((await call(() => error)).res.status).not.toBe(401);
      }
      expect((await call(() => new InvalidCredentialsError("x"))).res.status).toBe(401);
    });
  });

  describe("HTTPException", () => {
    it("keeps its status and becomes JSON with the code from a 'CODE: message' prefix", async () => {
      const { res, body } = await call(
        () => new HTTPException(403, { message: "SESSION_REQUIRED: This action requires a user session" }),
      );

      expect(res.status).toBe(403);
      expect(body).toEqual({
        status: "ERROR",
        code: "SESSION_REQUIRED",
        message: "This action requires a user session",
      });
    });

    it("recognizes a bare code, as the advisory lock throws it", async () => {
      const { res, body } = await call(() => new HTTPException(409, { message: "SYNC_IN_PROGRESS" }));

      expect(res.status).toBe(409);
      expect(body.code).toBe("SYNC_IN_PROGRESS");
      expect(body.message).toEqual(expect.any(String));
    });

    it.each([
      [401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"],
      [408, "REQUEST_TIMEOUT"], [409, "CONFLICT"], [429, "RATE_LIMITED"],
    ] as const)("falls back to a code for status %i when the message has none", async (status, code) => {
      const { res, body } = await call(() => new HTTPException(status, { message: "plain words" }));

      expect(res.status).toBe(status);
      expect(body).toEqual({ status: "ERROR", code, message: "plain words" });
    });
  });

  describe("unexpected errors", () => {
    it("returns a generic 500 outside development, hiding the real message", async () => {
      process.env.APP_ENV = "production";
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { res, body } = await call(() => new Error("connection to db-prod-3 refused"));

      expect(res.status).toBe(500);
      expect(body).toMatchObject({ status: "ERROR", code: "INTERNAL_ERROR", message: "Unknown Error" });
      expect(JSON.stringify(body)).not.toContain("db-prod-3");
    });

    it("reveals the real message in development", async () => {
      process.env.APP_ENV = "development";
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { res, body } = await call(() => new Error("boom"));

      expect(res.status).toBe(500);
      expect(body.message).toBe("boom");
    });

    it("returns the request id so a report can be matched to its log line", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { res, body } = await call(() => new Error("boom"));

      expect(body.requestId).toEqual(expect.any(String));
      expect(body.requestId).toBe(res.headers.get("X-Request-Id"));
    });

    it("logs the real error once, with the method, path and request id", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      const { body } = await call(() => new Error("boom"));

      expect(log).toHaveBeenCalledTimes(1);
      const logged = log.mock.calls[0]!.map(String).join(" ");
      expect(logged).toContain("boom");
      expect(logged).toContain("GET");
      expect(logged).toContain("/x");
      expect(logged).toContain(body.requestId);
    });
  });

  describe("logging expected errors", () => {
    it("doesn't log client mistakes as server errors", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await call(() => new GameNotFoundError("g1"));
      await call(() => new ValidationError("bad"));
      await call(() => new HTTPException(401, { message: "SIGNAL_LOST: nope" }));

      expect(log).not.toHaveBeenCalled();
    });

    it("does log an upstream platform failure, which someone may need to act on", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await call(() => new ProviderUnavailableError("SteamProvider", "HTTP 500"));

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]!.map(String).join(" ")).toContain("SteamProvider");
    });
  });

  describe("notFoundHandler", () => {
    it("answers an unknown route with the same JSON shape", async () => {
      const res = await makeApp(() => new Error()).request("/nope");

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ status: "ERROR", code: "ROUTE_NOT_FOUND" });
    });
  });
});
