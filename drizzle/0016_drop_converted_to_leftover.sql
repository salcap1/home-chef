-- Drop unused leftover event type from inventory_event_type enum.
UPDATE "inventory_events"
SET "event_type" = 'adjusted'
WHERE "event_type" = 'converted_to_leftover';--> statement-breakpoint
ALTER TABLE "inventory_events" ALTER COLUMN "event_type" TYPE text;--> statement-breakpoint
DROP TYPE "public"."inventory_event_type";--> statement-breakpoint
CREATE TYPE "public"."inventory_event_type" AS ENUM(
  'purchased',
  'added',
  'cooked',
  'consumed',
  'discarded',
  'expired',
  'adjusted',
  'removed'
);--> statement-breakpoint
ALTER TABLE "inventory_events"
  ALTER COLUMN "event_type" TYPE "public"."inventory_event_type"
  USING "event_type"::"public"."inventory_event_type";
