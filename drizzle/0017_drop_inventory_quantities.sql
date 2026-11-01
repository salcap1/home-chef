ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "quantity_text";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "quantity_value";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "quantity_unit";--> statement-breakpoint
ALTER TABLE "inventory_events" DROP COLUMN IF EXISTS "quantity_delta_value";--> statement-breakpoint
ALTER TABLE "inventory_events" DROP COLUMN IF EXISTS "quantity_delta_unit";
