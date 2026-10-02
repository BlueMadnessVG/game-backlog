import { setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

export const SESSION_COOKIE_NAME = "backlog_session";

// Keep in sync with jwt.utils.ts's own default expiresIn ("7d") — a
// cookie that outlives the JWT inside it just means the browser holds an
// already-expired, useless cookie a bit longer than necessary.
const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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
 */
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}
