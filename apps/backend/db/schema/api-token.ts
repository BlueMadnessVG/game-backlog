import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users, timestamps } from "./core";

/**
 * Opaque, long-lived API tokens for machine/service clients (e.g. the
 * achievement-ai assistant) — distinct from the session JWTs issued to
 * human logins (see jwt.utils.ts). Only a hash of the token is ever
 * stored; the plaintext is shown to the user exactly once, at creation
 * (see createApiToken in lib/api-token.utils.ts).
 *
 * Revocation is a soft delete (`revokedAt`, not a deleted row) so past
 * usage isn't lost from history/audit.
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Human label so a user with multiple tokens can tell them apart,
    // e.g. "achievement-ai assistant".
    name: text("name").notNull(),
    // SHA-256 hex digest (64 chars) — see hashApiToken's doc comment for
    // why this is SHA-256 and not the argon2id password.utils.ts uses.
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    // First ~12 chars of the plaintext token, stored so a "your tokens"
    // list can show e.g. "bkl_a1b2c3…" without ever re-displaying the
    // secret itself.
    tokenPrefix: varchar("token_prefix", { length: 12 }).notNull(),
    // A single scope string for now (e.g. "read:library") rather than a
    // scopes array/jsonb column — nothing in this codebase issues
    // multi-scope tokens yet, and a second scope is a cheap migration to
    // add later if it's ever actually needed.
    scope: varchar("scope", { length: 64 }).notNull().default("read:library"),
    lastUsedAt: timestamp("last_used_at"),
    // null = never expires. Recommend always setting one when creating a
    // token, but the schema doesn't force it.
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    ...timestamps,
  },
  (table) => ({
    userIdIdx: index("api_token_user_id_idx").on(table.userId),
    // No separate index on tokenHash — .unique() above already creates one.
  }),
);

/**
 * Append-only audit log for API-token lifecycle events. Written in the SAME
 * transaction as the token create/revoke (auth.services.ts), so a token
 * row can never exist — or be revoked — without a record of who did it,
 * from where, and using which credential kind. Not consulted at runtime;
 * it exists so a future "who minted/revoked my keys" UI or incident
 * post-mortem has the raw events instead of guesses.
 */
export const apiTokenEvents = pgTable(
  "api_token_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Cascade: if a token row is ever hard-deleted, its events go too.
    tokenId: uuid("token_id")
      .references(() => apiTokens.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Twin of apiTokens.scope's varchar-not-enum choice: "created" /
    // "revoked" for now, a cheap picklist expansion if a third action is
    // ever actually wanted.
    action: varchar("action", { length: 32 }).notNull(),
    // Request context at the time of the event. jsonb so new fields (IP
    // from a non-proxied deploy, a correlation id, …) don't need a
    // migration — this table is append-only by design.
    metadata: jsonb("metadata")
      .$type<{
        triggeredBy: "session" | "apiToken";
        ip: string;
        userAgent: string | null;
      }>()
      .notNull(),
    // Deliberately NOT `timestamps`: audit rows are immutable, so an
    // `updated_at` column would be noise.
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tokenIdIdx: index("api_token_events_token_id_idx").on(table.tokenId),
    userIdIdx: index("api_token_events_user_id_idx").on(table.userId),
    // The common query is "what happened to THIS token, in order".
    tokenIdCreatedAtIdx: index(
      "api_token_events_token_id_created_at_idx",
    ).on(table.tokenId, table.createdAt),
  }),
);
