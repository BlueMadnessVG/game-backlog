import type { Hono } from "hono";

import { signAuthToken } from "../lib/jwt.utils";

export const TEST_USER_ID = "test-user-1";
export const TEST_USER_EMAIL = "test@example.com";

type RequestLike = { request: Hono["request"] };

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
export async function withAuth<T extends RequestLike>(
  app: T,
  userId = TEST_USER_ID,
  email = TEST_USER_EMAIL,
): Promise<T> {
  const token = await signAuthToken({
    sub: userId,
    email,
    provider: "google",
  });

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

