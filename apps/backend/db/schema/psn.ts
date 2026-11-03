import { pgTable, uuid, text, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./core";

/**
 * The user's linked PlayStation Network account, with the tokens PSN issued.
 * Games and trophies are not PSN tables: they live in the shared `games` /
 * `achievements` tables, keyed by (platform, external_id).
 *
 * `accessToken` and `refreshToken` are AES-256-GCM ciphertext
 * (lib/Encryption.utils.ts); only PsnAdapter reads or writes them.
 */
export const psnAccounts = pgTable(
  "psn_accounts",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull().unique(),
    onlineId: varchar("online_id", { length: 255 }),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
    lastSync: timestamp("last_sync"),
  },
  (table) => ({
    accountIdIdx: uniqueIndex("psn_account_id_idx").on(table.accountId),
  }),
);
