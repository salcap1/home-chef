CREATE TABLE "grocery_list_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_list_categories" ADD CONSTRAINT "grocery_list_categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_list_categories_household_name_uidx" ON "grocery_list_categories" USING btree ("household_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_list_categories_household_default_uidx" ON "grocery_list_categories" USING btree ("household_id") WHERE "is_default" = true;
--> statement-breakpoint
CREATE INDEX "grocery_list_categories_household_id_idx" ON "grocery_list_categories" USING btree ("household_id");
--> statement-breakpoint
INSERT INTO "grocery_list_categories" ("household_id", "name", "sort_order", "is_default")
SELECT h."id", 'Grocery', 0, true
FROM "households" h
WHERE NOT EXISTS (
  SELECT 1 FROM "grocery_list_categories" c
  WHERE c."household_id" = h."id" AND c."is_default" = true
);
--> statement-breakpoint
ALTER TABLE "grocery_list_items" ADD COLUMN "category_id" uuid;
--> statement-breakpoint
UPDATE "grocery_list_items" AS gli
SET "category_id" = glc."id"
FROM "grocery_list_categories" AS glc
WHERE glc."household_id" = gli."household_id" AND glc."is_default" = true;
--> statement-breakpoint
ALTER TABLE "grocery_list_items" ALTER COLUMN "category_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_category_id_grocery_list_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."grocery_list_categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "grocery_list_items_category_idx" ON "grocery_list_items" USING btree ("category_id");
