CREATE TABLE "kroger_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"location_id" text NOT NULL,
	"location_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kroger_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_token" text NOT NULL,
	"household_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kroger_connections" ADD CONSTRAINT "kroger_connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kroger_oauth_states" ADD CONSTRAINT "kroger_oauth_states_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kroger_connections_household_id_uidx" ON "kroger_connections" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kroger_oauth_states_token_uidx" ON "kroger_oauth_states" USING btree ("state_token");--> statement-breakpoint
CREATE INDEX "kroger_oauth_states_expires_idx" ON "kroger_oauth_states" USING btree ("expires_at");