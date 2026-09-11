import * as v from "valibot";

export const OAuthProviderSchema = v.picklist(["google", "discord"]);

export type OAuthProvider = v.InferOutput<typeof OAuthProviderSchema>;

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
