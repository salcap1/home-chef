DROP TABLE IF EXISTS "leftovers";--> statement-breakpoint
ALTER TABLE "meal_plan_items" DROP COLUMN IF EXISTS "leftover_of_item_id";
