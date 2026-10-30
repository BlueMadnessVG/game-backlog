import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  real,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users, games, timestamps } from "./core";

/**
 * One achievement (Steam), achievement (Xbox) or trophy (PSN) of a game. The
 * definition is a fact about the GAME, shared by every user who owns it; what
 * a user has unlocked lives in `user_achievements`.
 */
export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    // The platform's key for it: Steam apiName, Xbox achievement id, PSN trophyId.
    externalKey: varchar("external_key", { length: 255 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    hidden: boolean("hidden").default(false).notNull(),
    iconUrl: text("icon_url"),
    iconGrayUrl: text("icon_gray_url"),
    // Percentage of players who unlocked it; null when the platform doesn't say.
    globalPercentage: real("global_percentage"),
    // Xbox gamerscore. Null where the platform has no points.
    points: integer("points"),
    // PSN trophy type (bronze | silver | gold | platinum). Null elsewhere.
    tier: varchar("tier", { length: 16 }),
    ...timestamps,
  },
  (table) => ({
    gameKeyUnique: unique("achievement_game_key_unique").on(
      table.gameId,
      table.externalKey,
    ),
    gameIdIdx: index("achievement_game_id_idx").on(table.gameId),
  }),
);

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
