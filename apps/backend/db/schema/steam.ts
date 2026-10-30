import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./core";

/**
 * The user's linked Steam account. Games and achievements are not Steam
 * tables: they live in the shared `games` / `achievements` tables, keyed by
 * (platform, external_id).
 */
export const steamAccounts = pgTable(
  "steam_accounts",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    steamId: varchar("steam_id", { length: 255 }).notNull().unique(),
    lastSync: timestamp("last_sync"),
    isPublic: boolean("is_public").default(true),
  },
  (table) => ({
    steamIdIdx: uniqueIndex("steam_id_idx").on(table.steamId),
  }),
);
