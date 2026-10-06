CREATE TABLE "api_token_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_token_events" ADD CONSTRAINT "api_token_events_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_token_events" ADD CONSTRAINT "api_token_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_token_events_token_id_idx" ON "api_token_events" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "api_token_events_user_id_idx" ON "api_token_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_token_events_token_id_created_at_idx" ON "api_token_events" USING btree ("token_id","created_at");