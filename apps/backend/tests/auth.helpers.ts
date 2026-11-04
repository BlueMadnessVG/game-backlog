import type { Hono } from "hono";

import { signAuthToken } from "../lib/jwt.utils";
import {
  errorHandler,
  notFoundHandler,
} from "../middleware/error.handler";

export const TEST_USER_ID = "test-user-1";
export const TEST_USER_EMAIL = "test@example.com";

type RequestLike = { request: Hono["request"] };
// Method syntax, so apps typed with their own Bindings still match.
type ErrorHandling = {
  onError(handler: any): unknown;
  notFound(handler: any): unknown;
};

/**
 * Gives a controller the app's error handling, as `index.ts` does for the real
 * app. Controllers just throw (a missing game, bad input, a platform down);
 * the handler turns that into the response. A test that mounts a controller on
 * its own needs it too, or every thrown error is a bare 500.
 */
export function withErrorHandling<T extends ErrorHandling>(app: T): T {
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

/**
 * Signs a session JWT for the given user and returns Authorization headers
 * that pass `authMiddleware`.
 */
export async function authHeaders(
  userId = TEST_USER_ID,
  email = TEST_USER_EMAIL,
): Promise<{ Authorization: string }> {
  const token = await signAuthToken({
    sub: userId,
    email,
    provider: "google",
  });
  return { Authorization: `Bearer ${token}` };
}

/**
 * Wraps a Hono app so every request automatically carries a valid session
 * JWT, unless the test provides its own `Authorization` header.
 *
 * Keeps controller tests focused on the handler logic instead of threading
 * headers through every `app.request(...)` call.
 */
export async function withAuth<T extends RequestLike & ErrorHandling>(
  app: T,
  userId = TEST_USER_ID,
  email = TEST_USER_EMAIL,
): Promise<T> {
  const token = await signAuthToken({
    sub: userId,
    email,
    provider: "google",
  });

  withErrorHandling(app);

  const authed = app as RequestLike;
  const originalRequest = authed.request.bind(app);

  authed.request = ((
    input: Parameters<RequestLike["request"]>[0],
    init?: Parameters<RequestLike["request"]>[1],
  ) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return originalRequest(input, { ...init, headers });
  }) as RequestLike["request"];

  return app;
}

