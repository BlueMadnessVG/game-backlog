import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — the standard/recommended IV length for GCM
const KEY_LENGTH = 32; // AES-256 requires a 32-byte key

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX) {
  throw new Error("❌ ENCRYPTION_KEY is not defined in environment variables.");
}

const key = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

if (key.length !== KEY_LENGTH) {
  throw new Error(
    `❌ ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). Generate one with \`openssl rand -hex 32\`.`,
  );
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * Output is `iv:authTag:ciphertext`, each hex-encoded — a single string
 * that fits straight into an existing `text()` column with no schema
 * change needed; only what gets WRITTEN there changes, not the column
 * type. A fresh random IV is generated on every call (required — reusing
 * an IV with the same key breaks GCM's security guarantees entirely), so
 * encrypting the same plaintext twice produces two different outputs by
 * design; that's expected, not a bug.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    ciphertext.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a value produced by {@link encrypt}.
 *
 * @throws If `encoded` is malformed, or if `authTag` doesn't verify
 *   (wrong key, or the ciphertext was tampered with) — GCM authenticates
 *   on decrypt, so corruption/tampering fails loudly here rather than
 *   silently returning garbage plaintext.
 */
export function decrypt(encoded: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted value");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
