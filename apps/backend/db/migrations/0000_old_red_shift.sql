CREATE TYPE "public"."game_status" AS ENUM('backlog', 'in-progress', 'completed', 'retired');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"cover_url" text,
	"platform" varchar(50) DEFAULT 'PC',
	"status" "game_status" DEFAULT 'backlog',
	"play_time" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "steam_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"steam_id" varchar(50) NOT NULL,
	"last_sync" timestamp,
	"is_public" boolean DEFAULT true,
	CONSTRAINT "steam_accounts_steam_id_unique" UNIQUE("steam_id")
);
--> statement-breakpoint
CREATE TABLE "steam_games" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"steam_app_id" integer NOT NULL,
	CONSTRAINT "steam_games_steam_app_id_unique" UNIQUE("steam_app_id")
);
--> statement-breakpoint
CREATE TABLE "user_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"game_id" uuid,
	"status" "game_status" DEFAULT 'backlog',
	"play_time" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_game_unique" UNIQUE("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "steam_accounts" ADD CONSTRAINT "steam_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_games" ADD CONSTRAINT "steam_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "title_idx" ON "games" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_id_idx" ON "steam_accounts" USING btree ("steam_id");