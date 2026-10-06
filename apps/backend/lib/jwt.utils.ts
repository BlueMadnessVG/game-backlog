import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET_STRING = process.env.JWT_SECRET;

if (!JWT_SECRET_STRING) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables.");
}

if (JWT_SECRET_STRING.length < 32) {
  throw new Error(
    "❌ JWT_SECRET is too short (must be at least 32 characters). Generate a strong secret with `openssl rand -hex 32`.",
  );
}

const encodedSecret = new TextEncoder().encode(JWT_SECRET_STRING);

/**
 * What a session token is allowed to do. Normal logins sign with no
 * `purpose` (defaults to "session"). A TOTP step-up (auth.services.ts'
 * stepUpTotp) signs with "step_up": that token exists ONLY to unlock the
 * mint-API-token route, and `verifyAuthToken` rejects it everywhere a
 * normal session is expected, so a leaked step-up token (5-minute TTL)
 * can't be replayed as a general session.
 */
export type TokenPurpose = "session" | "step_up";

/**
 * Claims carried by the app's session tokens. `sub` is the internal user id
 * (matches the `users.id` column) and is what auth.middleware exposes as
 * `c.get("userId")`. `provider` records which authentication method signed the
 * session in: a social provider, `"email"` for email/password accounts, or
 * `"step_up"` for a TOTP-confirmed short-lived session (whose `purpose`
 * claim is set too).
 */
export interface AuthTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  provider: "google" | "discord" | "email" | "step_up";
  purpose?: TokenPurpose;
}

/**
 * Thrown when a token's `purpose` claim isn't allowed for the path being
 * used — i.e. a step-up token presented as a normal session. Maps to a 401
 * in auth.middleware (same SIGNAL_LOST handling as any other bad token).
 */
export class TokenPurposeMismatchError extends Error {
  constructor(expectation: string) {
    super(
      `Token purpose does not satisfy this route (expected ${expectation})`,
    );
    this.name = "TokenPurposeMismatchError";
  }
}

/**
 * Signs a session JWT with the shared JWT_SECRET (same secret
 * auth.middleware verifies against).
 *
 * @param payload - The claims to embed.
 * @param expiresIn - jose time-string (e.g. "7d", "1h") or a Date/number.
 *   Defaults to 7 days.
 * @returns The signed JWT string.
 */
export async function signAuthToken(
  payload: AuthTokenPayload,
  expiresIn: string | number | Date = "7d",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedSecret);
}

/**
 * Verifies a session JWT and returns its claims.
 *
 * By default only ordinary sessions are accepted: a token whose `purpose`
 * is not "session" (i.e. a TOTP step-up token) throws
 * {@link TokenPurposeMismatchError}, so such tokens can never be replayed
 * as a general session — the escalate-via-token attack the purpose claim
 * exists to stop.
 *
 * @param token - The JWT to verify.
 * @param opts - `allowPurpose`: purposes accepted. Defaults to `["session"]`.
 *   The mint-API-token route passes `["session", "step_up"]` so an enrolled
 *   user's step-up proof is accepted exactly there.
 * @throws {JWTExpired} When the token is past its expiry.
 * @throws {JWSSignatureVerificationFailed} When the signature does not match
 *   JWT_SECRET.
 * @throws {TokenPurposeMismatchError} When the token's purpose is not allowed.
 * @returns The decoded claims.
 */
export async function verifyAuthToken(
  token: string,
  opts?: { allowPurpose?: TokenPurpose[] },
): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, encodedSecret);

  const purpose = (payload.purpose as TokenPurpose | undefined) ?? "session";
  const allowed = opts?.allowPurpose ?? ["session"];
  if (!allowed.includes(purpose)) {
    throw new TokenPurposeMismatchError(allowed.join(" or "));
  }

  return payload as unknown as AuthTokenPayload;
}
