import {
  pgTable,
  uuid,
  integer,
  unique,
  index,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { users, games, statusEnum, timestamps } from "./core";

export const userGames = pgTable(
  "user_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    status: statusEnum("status").default("backlog").notNull(),
    playTime: integer("play_time").default(0).notNull(),
    completionPercentage: real("completion_percentage").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),
    ...timestamps,
  },
  (table) => ({
    userGameUnique: unique("user_game_unique").on(table.userId, table.gameId),
    gameIdIdx: index("user_games_game_id_idx").on(table.gameId),
  }),
);
