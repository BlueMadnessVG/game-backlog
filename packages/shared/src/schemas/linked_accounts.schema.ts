import * as v from "valibot";

/**
 * GET /api/v1/accounts — the platform accounts a user has linked. Each entry
 * is `null` when that platform isn't linked. Never carries credentials: the
 * PSN access/refresh tokens stay server-side.
 */

const lastSync = v.nullable(v.string());

export const LinkedSteamSchema = v.object({
  steamId: v.string(),
  lastSync,
});

export const LinkedXboxSchema = v.object({
  xuid: v.string(),
  gamertag: v.nullable(v.string()),
  lastSync,
});

export const LinkedPsnSchema = v.object({
  accountId: v.string(),
  onlineId: v.nullable(v.string()),
  avatarUrl: v.nullable(v.string()),
  lastSync,
});

export const LinkedAccountsSchema = v.object({
  steam: v.nullable(LinkedSteamSchema),
  xbox: v.nullable(LinkedXboxSchema),
  psn: v.nullable(LinkedPsnSchema),
});

export type LinkedSteam = v.InferOutput<typeof LinkedSteamSchema>;
export type LinkedXbox = v.InferOutput<typeof LinkedXboxSchema>;
export type LinkedPsn = v.InferOutput<typeof LinkedPsnSchema>;
export type LinkedAccounts = v.InferOutput<typeof LinkedAccountsSchema>;
