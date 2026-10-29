import { setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

import { SESSION_TTL_SECONDS } from "./jwt.utils";

export const SESSION_COOKIE_NAME = "backlog_session";

/**
 * Attributes shared by set and clear. A browser only treats a Set-Cookie as
 * replacing an existing cookie when name, domain and path match, and a
 * cookie set with SameSite=None must carry Secure — so clearing with fewer
 * attributes than setting can be dropped by the browser, leaving the user
 * logged in after logout.
 */
const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: "None",
  path: "/",
} as const;

/**
 * Sets the browser session cookie holding a signed session JWT.
 *
 * `httpOnly` — JS (and therefore XSS) can never read this value, which is
 * the actual security win over the old "token in the response body,
 * stored by the frontend itself" approach.
 *
 * `secure: true` + `sameSite: "None"` — required together because the
 * frontend (5173) and this API (3000) are different origins; `Lax` would
 * silently never be sent on the frontend's fetch() calls. `localhost` is
 * treated as a secure context by modern browsers even over plain HTTP,
 * so this still works in local dev without HTTPS.
 *
 * `maxAge` is the JWT's own lifetime (SESSION_TTL_SECONDS), so the cookie
 * never outlives the token inside it.
 */
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_ATTRIBUTES,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, SESSION_COOKIE_ATTRIBUTES);
}
