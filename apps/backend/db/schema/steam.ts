import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  real,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { users, games, timestamps } from "./core";

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

export const steamGames = pgTable("steam_games", {
  gameId: uuid("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .primaryKey(),
  steamAppId: varchar("steam_app_id", { length: 255 }).notNull().unique(),
});

// Achievement definitions — static metadata, shared across all users
export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    steamAppId: varchar("steam_app_id", { length: 255 }).notNull(), // ties to steamGames
    apiName: varchar("api_name", { length: 255 }).notNull(), // Steam's internal key e.g. "ACH_WIN_100_GAMES"
    name: text("name").notNull(),
    description: text("description"),
    hidden: boolean("hidden").default(false).notNull(),
    iconUrl: text("icon_url"),
    iconGrayUrl: text("icon_gray_url"),
    globalPercentage: real("global_percentage"), // null if Steam doesn't provide it
    ...timestamps,
  },
  (table) => ({
    // Each achievement is unique per game
    appAchievementUnique: unique("app_achievement_unique").on(
      table.steamAppId,
      table.apiName,
    ),
    steamAppIdIdx: index("achievement_steam_app_id_idx").on(table.steamAppId),
  }),
);

// User unlock state — one row per user per achievement
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    achievementId: uuid("achievement_id")
      .references(() => achievements.id, { onDelete: "cascade" })
      .notNull(),
    achieved: boolean("achieved").default(false).notNull(),
    unlockedAt: timestamp("unlocked_at"),
    ...timestamps,
  },
  (table) => ({
    // A user can only have one state per achievement
    userAchievementUnique: unique("user_achievement_unique").on(
      table.userId,
      table.achievementId,
    ),
    userIdIdx: index("user_achievement_user_id_idx").on(table.userId),
    achievementIdIdx: index("user_achievement_achievement_id_idx").on(
      table.achievementId,
    ),
  }),
);
