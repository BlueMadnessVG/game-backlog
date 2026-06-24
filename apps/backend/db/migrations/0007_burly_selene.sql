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
ALTER TABLE "psn_accounts" ADD CONSTRAINT "psn_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_games" ADD CONSTRAINT "psn_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_user_trophies" ADD CONSTRAINT "psn_user_trophies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psn_user_trophies" ADD CONSTRAINT "psn_user_trophies_trophy_id_psn_trophies_id_fk" FOREIGN KEY ("trophy_id") REFERENCES "public"."psn_trophies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "psn_account_id_idx" ON "psn_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "psn_trophy_np_comm_id_idx" ON "psn_trophies" USING btree ("np_communication_id");--> statement-breakpoint
CREATE INDEX "psn_user_trophy_user_id_idx" ON "psn_user_trophies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "psn_user_trophy_trophy_id_idx" ON "psn_user_trophies" USING btree ("trophy_id");