import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  real,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, games, timestamps } from "./core";
import { description } from "valibot";

export const xboxAccounts = pgTable(
  "xbox_accounts",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    // Xbox User ID — the stable numeric identifier from Xbox Live
    xuid: varchar("xuid", { length: 255 }).notNull().unique(),
    gamertag: varchar("gamertag", { length: 255 }),
    lastSync: timestamp("last_sync"),
  },
  (table) => ({
    xuidIdx: uniqueIndex("xbox_xuid_idx").on(table.xuid),
  }),
);

export const xboxGames = pgTable("xbox_games", {
  gameId: uuid("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .primaryKey(),
  titleId: varchar("title_id", { length: 255 }).notNull().unique(),
});

export const xboxAchievements = pgTable(
  "xbox_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleId: varchar("title_id", { length: 255 }).notNull(),
    apiName: varchar("api_name", { length: 255 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSecret: boolean("is_secret").default(false).notNull(),
    iconUrl: text("icon_url"),
    iconUnlockedUrl: text("icon_unlocked_url"),
    globalPercentage: real("global_percentage"),
    gamerscore: real("gamerscore").default(0),
    ...timestamps,
  },
  (table) => ({
    xboxAppAchievementUnique: unique("xbox_app_achievement_unique").on(
      table.titleId,
      table.apiName,
    ),
    titleIdIdx: index("xbox_achievement_title_id_idx").on(table.titleId),
  }),
);

export const xboxUserAchievements = pgTable(
  "xbox_user_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    achievementId: uuid("achievement_id")
      .references(() => xboxAchievements.id, { onDelete: "cascade" })
      .notNull(),
    achieved: boolean("achieved").default(false).notNull(),
    unlockedAt: timestamp("unlocked_at"),
    ...timestamps,
  },
  (table) => ({
    xboxUserAchievementUnique: unique("xbox_user_achievement_unique").on(
      table.userId,
      table.achievementId,
    ),
    userIdIdx: index("xbox_user_achievement_user_id_idx").on(table.userId),
    achievementIdIdx: index("xbox_user_achievement_achievement_id_idx").on(
      table.achievementId,
    ),
  }),
);
