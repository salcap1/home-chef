CREATE TYPE "public"."ai_usage_category" AS ENUM('conversation', 'inventory', 'planning', 'recipe', 'grocery', 'memory', 'cost');--> statement-breakpoint
CREATE TYPE "public"."conversation_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."inventory_event_type" AS ENUM('purchased', 'added', 'consumed', 'discarded', 'adjusted', 'removed');--> statement-breakpoint
CREATE TYPE "public"."inventory_location" AS ENUM('pantry', 'refrigerator', 'freezer', 'other');--> statement-breakpoint
CREATE TYPE "public"."preference_kind" AS ENUM('like', 'dislike', 'constraint', 'note');--> statement-breakpoint
CREATE TYPE "public"."preference_strength" AS ENUM('explicit', 'inferred');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"model" text NOT NULL,
	"category" "ai_usage_category" DEFAULT 'conversation' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"telegram_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid,
	"telegram_update_id" text,
	"telegram_message_id" text,
	"role" "conversation_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"telegram_user_id" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"member_id" uuid,
	"event_type" "inventory_event_type" NOT NULL,
	"description" text NOT NULL,
	"quantity_delta_value" numeric(12, 3),
	"quantity_delta_unit" text,
	"telegram_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"location" "inventory_location" DEFAULT 'other' NOT NULL,
	"quantity_text" text,
	"quantity_value" numeric(12, 3),
	"quantity_unit" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "preference_kind" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"strength" "preference_strength" DEFAULT 'explicit' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_telegram_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"update_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" text,
	"status" text DEFAULT 'processed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_household_created_idx" ON "ai_usage" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_household_created_idx" ON "conversation_messages" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_telegram_update_id_uidx" ON "conversation_messages" USING btree ("telegram_update_id") WHERE "conversation_messages"."telegram_update_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_telegram_user_id_uidx" ON "household_members" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "household_members_household_id_idx" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "households_telegram_chat_id_uidx" ON "households" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "inventory_events_household_id_idx" ON "inventory_events" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "inventory_events_telegram_message_id_idx" ON "inventory_events" USING btree ("telegram_message_id");--> statement-breakpoint
CREATE INDEX "inventory_items_household_id_idx" ON "inventory_items" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "inventory_items_normalized_name_idx" ON "inventory_items" USING btree ("household_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_household_kind_key_uidx" ON "preferences" USING btree ("household_id","kind","key");--> statement-breakpoint
CREATE INDEX "preferences_household_id_idx" ON "preferences" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "processed_telegram_updates_update_id_uidx" ON "processed_telegram_updates" USING btree ("update_id");