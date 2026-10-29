process.env.JWT_SECRET =
  "test-jwt-secret-test-jwt-secret-test-jwt-secret-1234";
// 32 bytes as 64 hex chars — lib/Encryption.utils.ts throws at import time
// without it, and anything that touches TOTP or PSN tokens imports it.
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
