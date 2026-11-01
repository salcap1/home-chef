CREATE TABLE "grocery_product_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"normalized_name" text NOT NULL,
	"preferred_upc" text NOT NULL,
	"preferred_brand" text,
	"product_description" text,
	"times_chosen" integer DEFAULT 1 NOT NULL,
	"last_chosen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_product_preferences" ADD CONSTRAINT "grocery_product_preferences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_product_prefs_household_name_uidx" ON "grocery_product_preferences" USING btree ("household_id","normalized_name");--> statement-breakpoint
CREATE INDEX "grocery_product_prefs_household_id_idx" ON "grocery_product_preferences" USING btree ("household_id");