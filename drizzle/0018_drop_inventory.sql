DROP TABLE IF EXISTS "inventory_events";--> statement-breakpoint
DROP TABLE IF EXISTS "inventory_items";--> statement-breakpoint
DROP TYPE IF EXISTS "inventory_event_type";--> statement-breakpoint
UPDATE "ai_usage" SET "category" = 'conversation' WHERE "category" = 'inventory';--> statement-breakpoint
ALTER TYPE "ai_usage_category" RENAME TO "ai_usage_category_old";--> statement-breakpoint
CREATE TYPE "ai_usage_category" AS ENUM('conversation', 'planning', 'recipe', 'grocery', 'memory', 'cost');--> statement-breakpoint
ALTER TABLE "ai_usage" ALTER COLUMN "category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_usage" ALTER COLUMN "category" TYPE "ai_usage_category" USING "category"::text::"ai_usage_category";--> statement-breakpoint
ALTER TABLE "ai_usage" ALTER COLUMN "category" SET DEFAULT 'conversation';--> statement-breakpoint
DROP TYPE "ai_usage_category_old";
