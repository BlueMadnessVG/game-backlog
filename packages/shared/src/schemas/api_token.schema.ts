import * as v from "valibot";

/**
 * Known API token scopes. Kept as a picklist (matching PlatformSchema /
 * GameStatusSchema's style) rather than a free string, so a second scope is
 * a one-line addition here instead of an unvalidated value nothing checks.
 *
 * - "read:library"  — GET/HEAD/OPTIONS on the library and platform data
 *   routes. The safe-method enforcement lives in auth.middleware.ts, not
 *   per-route, so a read token is denied by default on any future mutating
 *   route without someone remembering to add a guard.
 * - "write:library" — allows mutating actions. Issued deliberately to
 *   consumers that legitimately POST/DELETE (see the seed's
 *   script/create-api-token.ts); ask for it explicitly.
 */
export const ApiTokenScopeSchema = v.picklist(["read:library", "write:library"]);

export const CreateApiTokenSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "name is required"),
    v.maxLength(100),
  ),
  scope: v.optional(ApiTokenScopeSchema),
  expiresInDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

/**
 * One of a user's issued tokens, as listed back to them. Never includes
 * the secret itself — only `tokenPrefix`, matching what AuthService.listApiTokens
 * actually returns.
 */
export const ApiTokenSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(1)),
  tokenPrefix: v.string(),
  scope: ApiTokenScopeSchema,
  lastUsedAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  expiresAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  revokedAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
});

/** What POST /auth/api-tokens returns — the ONLY response that ever carries the plaintext token. */
export const CreateApiTokenResultSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  token: v.string(),
  tokenPrefix: v.string(),
});

export const CreateApiTokenResponseSchema = v.object({
  status: v.picklist(["SUCCESS", "ERROR"]),
  data: CreateApiTokenResultSchema,
});

export const ApiTokensResponseSchema = v.object({
  status: v.picklist(["SUCCESS", "ERROR"]),
  data: v.array(ApiTokenSchema),
});

export type ApiTokenScope = v.InferOutput<typeof ApiTokenScopeSchema>;
export type CreateApiTokenInput = v.InferOutput<typeof CreateApiTokenSchema>;
export type ApiToken = v.InferOutput<typeof ApiTokenSchema>;
export type CreateApiTokenResult = v.InferOutput<
  typeof CreateApiTokenResultSchema
>;
export type CreateApiTokenResponse = v.InferOutput<
  typeof CreateApiTokenResponseSchema
>;
export type ApiTokensResponse = v.InferOutput<typeof ApiTokensResponseSchema>;
