import { pgTable, uuid, integer, unique } from "drizzle-orm/pg-core";
import { users, games, statusEnum, timestamps } from "./core";

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
