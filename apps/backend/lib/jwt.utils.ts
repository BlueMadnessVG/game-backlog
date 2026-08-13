import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET_STRING = process.env.JWT_SECRET;

if (!JWT_SECRET_STRING) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables.");
}

const encodedSecret = new TextEncoder().encode(JWT_SECRET_STRING);

/**
 * Claims carried by the app's session tokens. `sub` is the internal user id
 * (matches the `users.id` column) and is what auth.middleware exposes as
 * `c.get("userId")`.
 */
export interface AuthTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  provider: "google" | "discord";
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
 * @param token - The JWT to verify.
 * @throws {JWTExpired} When the token is past its expiry.
 * @throws {JWSSignatureVerificationFailed} When the signature does not match
 *   JWT_SECRET.
 * @returns The decoded claims.
 */
export async function verifyAuthToken(
  token: string,
): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, encodedSecret);
  return payload as unknown as AuthTokenPayload;
}
