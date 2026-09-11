/**
 * Password hashing isolated behind a small module so the service layer never
 * depends on the Bun global directly. Tests can mock this module; production
 * runs on Bun's native argon2id (no extra dependency, AUDIT-included params).
 */

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}