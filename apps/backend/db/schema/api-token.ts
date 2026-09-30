import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
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
