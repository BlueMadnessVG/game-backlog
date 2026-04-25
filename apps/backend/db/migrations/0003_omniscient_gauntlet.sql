ALTER TABLE "user" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "user_email_unique";--> statement-breakpoint
ALTER TABLE "steam_accounts" DROP CONSTRAINT "steam_accounts_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "steam_accounts" ADD CONSTRAINT "steam_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");