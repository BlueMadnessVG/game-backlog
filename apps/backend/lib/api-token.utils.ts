import { randomBytes, createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";

// ⚠️ Best guess, not verified: I don't have db/index.ts, so I don't know
// your actual export name/path for the Drizzle client. game-deletion.utils.ts
// imports `type { DbClient } from "../db"` (no file extension, no /index),
// so this matches that import STYLE — but confirm the named export here is
// actually `db` (vs. e.g. a default export, or something else) before this
// compiles.
import { db } from "../db";
import { apiTokens } from "../db/schema";

const TOKEN_PREFIX = "bkl_";
const TOKEN_BYTES = 32;

/**
 * True if `token` is one of OUR opaque API tokens rather than a session
 * JWT — the prefix is what lets auth.middleware route between the two
 * verification paths without trying (and failing) JWT verification first.
 */
export function isApiToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

/**
 * Deliberately SHA-256, NOT the argon2id password.utils.ts uses.
 *
 * Password hashing is slow on purpose — that's what resists brute-forcing
 * a low-entropy HUMAN secret someone chose. An API token isn't that kind
 * of secret: it's 32 cryptographically random bytes (~256 bits) generated
 * by us, so ITS OWN entropy is what prevents guessing, not the hash's
 * slowness. This hash also runs on every single authenticated request
 * (every tool call an assistant makes), so a deliberately-slow KDF here
 * would add real, compounding latency for no corresponding security gain.
 */
function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new opaque API token for `userId`.
 *
 * @returns The plaintext token, shown/returned exactly ONCE. Only its hash
 *   is ever persisted — same rule as GitHub PATs or Stripe keys: if it's
 *   lost, there is no "look it up again," only revoke-and-reissue.
 */
export async function createApiToken(
  userId: string,
  opts: { name: string; scope?: string; expiresAt?: Date },
): Promise<{ id: string; token: string; tokenPrefix: string }> {
  const secret = randomBytes(TOKEN_BYTES).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  const tokenPrefix = token.slice(0, 12);

  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      name: opts.name,
      tokenHash: hashApiToken(token),
      tokenPrefix,
      scope: opts.scope ?? "read:library",
      expiresAt: opts.expiresAt ?? null,
    })
    .returning({ id: apiTokens.id });

  if (!row) {
    throw new Error("Failed to create API token record");
  }

  return { id: row.id, token, tokenPrefix };
}

/**
 * Verifies an opaque API token.
 *
 * Mirrors verifyAuthToken's contract (jwt.utils.ts) on purpose — same
 * shape of "give me a userId or throw/return null" — so auth.middleware
 * can treat both credential kinds uniformly once it's decided which one
 * it's looking at.
 *
 * @returns `{ userId }`, or `null` if the token is unknown, revoked, or
 *   past its expiry.
 */
export async function verifyApiToken(
  token: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashApiToken(token);

  const [row] = await db
    .select({
      id: apiTokens.id,
      userId: apiTokens.userId,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Fire-and-forget, matching the background-job style your own
  // controllers already use (e.g. achievement sync after /sync) — a
  // request shouldn't be slowed down or fail because this bookkeeping
  // write is slow.
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch((err: unknown) => {
      console.error("[ApiToken] Failed to update lastUsedAt:", err);
    });

  return { userId: row.userId };
}

/** Revokes a token (soft delete — past usage history is kept, not erased). */
export async function revokeApiToken(
  userId: string,
  tokenId: string,
): Promise<void> {
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)));
}
