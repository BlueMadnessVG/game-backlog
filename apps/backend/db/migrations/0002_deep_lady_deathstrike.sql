CREATE TYPE "public"."platform" AS ENUM('steam', 'epic', 'xbox', 'playstation', 'gog', 'manual');--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "platform" SET DEFAULT 'steam'::"public"."platform";--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "platform" SET DATA TYPE "public"."platform" USING "platform"::"public"."platform";--> statement-breakpoint
ALTER TABLE "steam_accounts" ALTER COLUMN "steam_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "steam_games" ALTER COLUMN "steam_app_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "completion_percentage" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "last_played_at" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;