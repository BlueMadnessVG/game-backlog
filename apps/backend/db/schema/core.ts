import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
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

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

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
  passwordHash: text("password_hash"),
  // Base32 TOTP secret, AES-256-GCM encrypted (lib/Encryption.utils.ts,
  // `iv:tag:ct`). Promoted from totpPendingSecret by
  // POST /auth/totp/enroll/confirm (auth.services.ts) when the user opts in
  // to MFA. null = not enrolled. Once set, minting API tokens requires a
  // `purpose: "step_up"` session (see stepUpTotp). The plaintext is shown
  // once, in the enroll/start response, and never again.
  totpSecret: text("totp_secret"),
  // Secret issued by POST /auth/totp/enroll/start and not yet proven: the
  // user must submit a valid code from it to /enroll/confirm, which moves it
  // to totpSecret. Encrypted like totpSecret. A new start overwrites it.
  totpPendingSecret: text("totp_pending_secret"),
  // Defaulted, and NEVER set from request input — `register()`
  // (auth.services.ts) and the OAuth upsert both omit it, so every self-serve
  // signup lands on "user". Promotion is deliberately not reachable over HTTP;
  // see script/seed-user.ts for the only supported path.
  role: userRoleEnum("role").default("user").notNull(),
  ...timestamps,
});

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    platform: platformEnum("platform").default("steam"),
    // The platform's own id for the game: Steam app id, Xbox title id, PSN
    // npCommunicationId. With `platform` it is the game's identity, so the PS4
    // and PS5 versions of a title are two games. Nullable only while Xbox and
    // PSN are being moved onto the platform engine.
    externalId: varchar("external_id", { length: 255 }),
    // Platform-specific facts the engine passes back to the adapter when it
    // fetches achievements (PSN: npServiceName, trophyTitlePlatform).
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    iconUrl: text("icon_url"),
    coverUrl: text("cover_url"),
    bannerUrl: text("banner_url"),
    // Whether the platform lists any achievements/trophies for this game.
    // A fact about the GAME, so it lives on the shared catalog row:
    //   null  = not checked yet (shown)
    //   true  = has achievements (shown)
    //   false = the platform says it has none (hidden from library reads)
    // Set by the achievement sync (lib/game-catalog.ts); never by deleting
    // the row. Per-user progress (status, play time, completion, last
    // played) lives on user_games, not here.
    hasAchievements: boolean("has_achievements"),
    ...timestamps,
  },
  (table) => ({
    titleIdx: index("title_idx").on(table.title),
    platformExternalIdUnique: uniqueIndex("games_platform_external_id_idx").on(
      table.platform,
      table.externalId,
    ),
    titlePlatformUnique: uniqueIndex("title_platform_unique_idx").on(
      table.title,
      table.platform,
    ),
  }),
);
