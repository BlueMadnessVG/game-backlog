CREATE TYPE "public"."platform" AS ENUM('steam', 'epic', 'xbox', 'playstation', 'gog', 'manual');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('backlog', 'in-progress', 'completed', 'retired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'discord');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"platform" "platform" DEFAULT 'steam',
	"external_id" varchar(255),
	"metadata" jsonb,
	"icon_url" text,
	"cover_url" text,
	"banner_url" text,
	"has_achievements" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"totp_secret" text,
	"totp_pending_secret" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "steam_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"steam_id" varchar(255) NOT NULL,
	"last_sync" timestamp,
	"is_public" boolean DEFAULT true,
	CONSTRAINT "steam_accounts_steam_id_unique" UNIQUE("steam_id")
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"external_key" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"icon_url" text,
	"icon_gray_url" text,
	"global_percentage" real,
	"points" integer,
	"tier" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_game_key_unique" UNIQUE("game_id","external_key")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"achieved" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievement_unique" UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "xbox_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xuid" varchar(255) NOT NULL,
	"gamertag" varchar(255),
	"last_sync" timestamp,
	CONSTRAINT "xbox_accounts_xuid_unique" UNIQUE("xuid")
);
--> statement-breakpoint
CREATE TABLE "xbox_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" varchar(255) NOT NULL,
	"api_name" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"icon_url" text,
	"icon_unlocked_url" text,
	"global_percentage" real,
	"gamerscore" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xbox_app_achievement_unique" UNIQUE("title_id","api_name")
);
--> statement-breakpoint
CREATE TABLE "xbox_games" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"title_id" varchar(255) NOT NULL,
	CONSTRAINT "xbox_games_title_id_unique" UNIQUE("title_id")
);
--> statement-breakpoint
CREATE TABLE "xbox_user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"achieved" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xbox_user_achievement_unique" UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "psn_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"online_id" varchar(255),
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"last_sync" timestamp,
	CONSTRAINT "psn_accounts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "psn_games" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"np_communication_id" varchar(255) NOT NULL,
	"trophy_title_platform" varchar(64),
	"np_service_name" varchar(16) DEFAULT 'trophy2',
	CONSTRAINT "psn_games_np_communication_id_unique" UNIQUE("np_communication_id")
);
--> statement-breakpoint
CREATE TABLE "psn_trophies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"np_communication_id" varchar(255) NOT NULL,
	"trophy_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"detail" text,
	"trophy_type" varchar(16) NOT NULL,
	"trophy_hidden" boolean DEFAULT false NOT NULL,
	"trophy_icon_url" text,
	"trophy_earned_rate" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psn_trophy_unique" UNIQUE("np_communication_id","trophy_id")
);
--> statement-breakpoint
CREATE TABLE "psn_user_trophies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trophy_id" uuid NOT NULL,
	"earned" boolean DEFAULT false NOT NULL,
	"earned_date_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psn_user_trophy_unique" UNIQUE("user_id","trophy_id")
);
--> statement-breakpoint
CREATE TABLE "user_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"status" "game_status" DEFAULT 'backlog' NOT NULL,
	"play_time" integer DEFAULT 0 NOT NULL,
	"completion_percentage" real DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_game_unique" UNIQUE("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"last_login_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_token_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"scope" varchar(64) DEFAULT 'read:library' NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "steam_accounts" ADD CONSTRAINT "steam_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_accounts" ADD CONSTRAINT "xbox_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_games" ADD CONSTRAINT "xbox_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_user_achievements" ADD CONSTRAINT "xbox_user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_user_achievements" ADD CONSTRAINT "xbox_user_achievements_achievement_id_xbox_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."xbox_achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_accounts" ADD CONSTRAINT "psn_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_games" ADD CONSTRAINT "psn_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_user_trophies" ADD CONSTRAINT "psn_user_trophies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_user_trophies" ADD CONSTRAINT "psn_user_trophies_trophy_id_psn_trophies_id_fk" FOREIGN KEY ("trophy_id") REFERENCES "public"."psn_trophies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_token_events" ADD CONSTRAINT "api_token_events_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_token_events" ADD CONSTRAINT "api_token_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "title_idx" ON "games" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "games_platform_external_id_idx" ON "games" USING btree ("platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "title_platform_unique_idx" ON "games" USING btree ("title","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_id_idx" ON "steam_accounts" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "achievement_game_id_idx" ON "achievements" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "user_achievement_user_id_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievement_achievement_id_idx" ON "user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xbox_xuid_idx" ON "xbox_accounts" USING btree ("xuid");--> statement-breakpoint
CREATE INDEX "xbox_achievement_title_id_idx" ON "xbox_achievements" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "xbox_user_achievement_user_id_idx" ON "xbox_user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xbox_user_achievement_achievement_id_idx" ON "xbox_user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "psn_account_id_idx" ON "psn_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "psn_trophy_np_comm_id_idx" ON "psn_trophies" USING btree ("np_communication_id");--> statement-breakpoint
CREATE INDEX "psn_user_trophy_user_id_idx" ON "psn_user_trophies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "psn_user_trophy_trophy_id_idx" ON "psn_user_trophies" USING btree ("trophy_id");--> statement-breakpoint
CREATE INDEX "user_games_game_id_idx" ON "user_games" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_account_unique" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_token_events_token_id_idx" ON "api_token_events" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "api_token_events_user_id_idx" ON "api_token_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_token_events_token_id_created_at_idx" ON "api_token_events" USING btree ("token_id","created_at");--> statement-breakpoint
CREATE INDEX "api_token_user_id_idx" ON "api_tokens" USING btree ("user_id");