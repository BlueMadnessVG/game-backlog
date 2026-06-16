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
ALTER TABLE "games" DROP CONSTRAINT "games_title_unique";--> statement-breakpoint
ALTER TABLE "xbox_accounts" ADD CONSTRAINT "xbox_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_games" ADD CONSTRAINT "xbox_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_user_achievements" ADD CONSTRAINT "xbox_user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xbox_user_achievements" ADD CONSTRAINT "xbox_user_achievements_achievement_id_xbox_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."xbox_achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xbox_xuid_idx" ON "xbox_accounts" USING btree ("xuid");--> statement-breakpoint
CREATE INDEX "xbox_achievement_title_id_idx" ON "xbox_achievements" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "xbox_user_achievement_user_id_idx" ON "xbox_user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xbox_user_achievement_achievement_id_idx" ON "xbox_user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "title_platform_unique_idx" ON "games" USING btree ("title","platform");