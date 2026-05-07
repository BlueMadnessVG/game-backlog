import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  real,
  pgEnum,
  index,
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

export const timestamps = {
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
    ...timestamps,
  },
  (table) => ({
    titleIdx: index("title_idx").on(table.title),
  }),
);
