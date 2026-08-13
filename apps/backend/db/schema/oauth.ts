import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, timestamps } from "./core";

export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "discord"]);

/**
 * Third-party OAuth identities (Google / Discord) linked to a user. One user
 * can have multiple rows (one per provider), which is what makes "sign in
 * with Discord after Google" resolve to the same account.
 */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: oauthProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at").defaultNow().notNull(),
    ...timestamps,
  },
  (table) => ({
    providerAccountUnique: uniqueIndex("oauth_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    userIdIdx: index("oauth_user_id_idx").on(table.userId),
  }),
);
