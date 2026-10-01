import { randomBytes, createHash } from "node:crypto";

const TOKEN_PREFIX = "bkl_";
const TOKEN_BYTES = 32;

/**
 * True if `token` is one of OUR opaque API tokens rather than a session
 * JWT — told apart by prefix, so auth.middleware can route to the right
 * verification path without attempting (and failing) JWT verification
 * first.
 */
export function isApiToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

/**
 * Deliberately SHA-256, NOT the argon2id password.utils.ts uses for
 * passwords. Password hashing is slow on purpose — that resists
 * brute-forcing a low-entropy HUMAN secret. An API token isn't that kind
 * of secret: it's 32 cryptographically random bytes (~256 bits) we
 * generate ourselves, so its own entropy is what prevents guessing, not
 * the hash's slowness. This hash also runs on every authenticated
 * request, so a deliberately-slow KDF here would add real, compounding
 * latency for no corresponding security gain.
 */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a new opaque API token: the plaintext (shown to the user
 * exactly once) plus its hash and a short prefix for display purposes.
 *
 * Pure/stateless on purpose — no database access here, matching
 * jwt.utils.ts and password.utils.ts. Persistence belongs to AuthService,
 * exactly the way it already owns storing a password hash after calling
 * hashPassword here.
 */
export function generateOpaqueToken(): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const secret = randomBytes(TOKEN_BYTES).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  return {
    token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, 12),
  };
}
