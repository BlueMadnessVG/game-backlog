import * as v from "valibot";

export const OAuthProviderSchema = v.picklist(["google", "discord"]);

export type OAuthProvider = v.InferOutput<typeof OAuthProviderSchema>;

/**
 * Account privilege level. Kept as a picklist (matching OAuthProviderSchema's
 * style) rather than a free string so an invalid role can't reach the DB.
 *
 * Deliberately NOT part of RegisterSchema: `register()` and the OAuth upsert
 * both leave `users.role` at its column default, so self-serve signup can
 * never self-assign "admin". Promotion is only reachable via
 * `script/seed-user.ts` (--admin / manifest role) or a direct DB write.
 *
 * A new level is a one-line addition here plus the pgEnum in
 * db/schema/core.ts — see require-admin.middleware.ts for the gate.
 */
export const UserRoleSchema = v.picklist(["user", "admin"]);

export type UserRole = v.InferOutput<typeof UserRoleSchema>;

export const OAuthCallbackQuerySchema = v.object({
  code: v.string(),
  state: v.string(),
});

/**
 * Email/username/password credentials come from `@repo/shared` so the backend
 * validates exactly what the frontend forms enforce.
 */

export const AuthEmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.email(),
);

export const AuthUsernameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(2),
  v.maxLength(24),
  v.regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and - are allowed"),
);

export const AuthPasswordSchema = v.pipe(
  v.string(),
  v.minLength(8, "Password must be at least 8 characters"),
  v.maxLength(72, "Password must be at most 72 characters"),
);

export const LoginSchema = v.object({
  email: AuthEmailSchema,
  password: v.pipe(v.string(), v.minLength(1)),
});

export const RegisterSchema = v.object({
  username: AuthUsernameSchema,
  email: AuthEmailSchema,
  password: AuthPasswordSchema,
});

export type LoginInput = v.InferOutput<typeof LoginSchema>;
export type RegisterInput = v.InferOutput<typeof RegisterSchema>;

/**
 * A 6-digit TOTP authenticator code. Shared by POST /auth/totp/enroll
 * (proves the user scanned the issued secret before it's enabled) and
 * POST /auth/step-up (proves possession to mint API tokens).
 */
export const TotpCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{6}$/, "Code must be exactly 6 digits"),
);

export const TotpEnrollSchema = v.object({
  code: TotpCodeSchema,
});

export const TotpStepUpSchema = v.object({
  code: TotpCodeSchema,
});

export type TotpEnrollInput = v.InferOutput<typeof TotpEnrollSchema>;
export type TotpStepUpInput = v.InferOutput<typeof TotpStepUpSchema>;
