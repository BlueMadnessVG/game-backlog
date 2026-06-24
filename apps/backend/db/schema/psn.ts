import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  real,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, games, timestamps } from "./core";

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

export const psnGames = pgTable("psn_games", {
  gameId: uuid("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .primaryKey(),
  npCommunicationId: varchar("np_communication_id", { length: 255 })
    .notNull()
    .unique(),
  trophyTitlePlatform: varchar("trophy_title_platform", { length: 64 }),
  npServiceName: varchar("np_service_name", { length: 16 }).default("trophy2"),
});

export const psnTrophies = pgTable(
  "psn_trophies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    npCommunicationId: varchar("np_communication_id", {
      length: 255,
    }).notNull(),
    trophyId: varchar("trophy_id", { length: 64 }).notNull(),
    name: text("name").notNull(),
    detail: text("detail"), // PSN's term for description
    trophyType: varchar("trophy_type", { length: 16 }).notNull(),
    trophyHidden: boolean("trophy_hidden").default(false).notNull(),
    trophyIconUrl: text("trophy_icon_url"),
    trophyEarnedRate: real("trophy_earned_rate"),
    ...timestamps,
  },
  (table) => ({
    psnTrophyUnique: unique("psn_trophy_unique").on(
      table.npCommunicationId,
      table.trophyId,
    ),
    npCommIdIdx: index("psn_trophy_np_comm_id_idx").on(table.npCommunicationId),
  }),
);

export const psnUserTrophies = pgTable(
  "psn_user_trophies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    trophyId: uuid("trophy_id")
      .references(() => psnTrophies.id, { onDelete: "cascade" })
      .notNull(),
    earned: boolean("earned").default(false).notNull(),
    earnedDateTime: timestamp("earned_date_time"),
    ...timestamps,
  },
  (table) => ({
    psnUserTrophyUnique: unique("psn_user_trophy_unique").on(
      table.userId,
      table.trophyId,
    ),
    userIdIdx: index("psn_user_trophy_user_id_idx").on(table.userId),
    trophyIdIdx: index("psn_user_trophy_trophy_id_idx").on(table.trophyId),
  }),
);
