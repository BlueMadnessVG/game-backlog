import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./core";

/**
 * The user's linked Xbox account. Games and achievements are not Xbox tables:
 * they live in the shared `games` / `achievements` tables, keyed by
 * (platform, external_id).
 */
export const xboxAccounts = pgTable(
  "xbox_accounts",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    xuid: varchar("xuid", { length: 255 }).notNull().unique(),
    gamertag: varchar("gamertag", { length: 255 }),
    lastSync: timestamp("last_sync"),
  },
  (table) => ({
    xuidIdx: uniqueIndex("xbox_xuid_idx").on(table.xuid),
  }),
);
