DROP TABLE IF EXISTS "processed_telegram_updates";--> statement-breakpoint
ALTER TABLE "households" DROP COLUMN IF EXISTS "telegram_chat_id";--> statement-breakpoint
ALTER TABLE "household_members" DROP COLUMN IF EXISTS "telegram_user_id";--> statement-breakpoint
ALTER TABLE "meal_plans" DROP COLUMN IF EXISTS "pinned_telegram_message_id";--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP COLUMN IF EXISTS "telegram_update_id";--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP COLUMN IF EXISTS "telegram_message_id";--> statement-breakpoint
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "telegram_message_id";
