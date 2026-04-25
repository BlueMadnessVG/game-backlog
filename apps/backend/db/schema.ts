import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  pgEnum,
  index,
  uniqueIndex,
  unique,
  real,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("game_status", [
  "backlog",
  "in-progress",
  "completed",
  "retired",
]);

export const platformEnum = pgEnum("platform", [
  "steam",
  "epic",
  "xbox",
  "playstation",
  "gog",
  "manual",
]);

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  ...timestamps,
});

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().unique(),
    platform: platformEnum("platform").default("steam"),
    status: statusEnum("status").default("backlog"),
    iconUrl: text("icon_url"),
    coverUrl: text("cover_url"),
    bannerUrl: text("banner_url"),
    playTime: integer("play_time").default(0),
    completionPercentage: real("completion_percentage").default(0),
    lastPlayedAt: timestamp("last_played_at"),
    ...timestamps, // gives you createdAt + updatedAt
  },
  (table) => ({
    titleIdx: index("title_idx").on(table.title),
  }),
);

export const userGames = pgTable(
  "user_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    gameId: uuid("game_id").references(() => games.id),
    status: statusEnum("status").default("backlog"),
    playTime: integer("play_time").default(0),
    ...timestamps,
  },
  (table) => ({
    userGameUnique: unique("user_game_unique").on(table.userId, table.gameId),
  }),
);

export const steamAccounts = pgTable(
  "steam_accounts",
  {
    userId: uuid("user_id")
      .references(() => users.id)
      .primaryKey(),
    steamId: varchar("steam_id", { length: 255 }).notNull().unique(),
    lastSync: timestamp("last_sync"),
    isPublic: boolean("is_public").default(true),
  },
  (table) => ({
    steamIdIdx: uniqueIndex("steam_id_idx").on(table.steamId),
  }),
);

// Mapping internal games to Steam AppIDs
export const steamGames = pgTable("steam_games", {
  gameId: uuid("game_id")
    .references(() => games.id)
    .primaryKey(),
  steamAppId: varchar("steam_app_id", { length: 255 }).notNull().unique(),
});
