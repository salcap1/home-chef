CREATE TYPE "public"."grocery_list_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."meal_plan_status" AS ENUM('draft', 'discussing', 'locked', 'completed');--> statement-breakpoint
CREATE TYPE "public"."meal_slot_type" AS ENUM('breakfast', 'lunch', 'dinner');--> statement-breakpoint
CREATE TABLE "grocery_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_list_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"quantity_text" text,
	"category" text DEFAULT 'other' NOT NULL,
	"is_purchased" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"meal_plan_id" uuid,
	"status" "grocery_list_status" DEFAULT 'active' NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"meal_date" text NOT NULL,
	"meal_type" "meal_slot_type" DEFAULT 'dinner' NOT NULL,
	"title" text NOT NULL,
	"recipe_id" uuid,
	"notes" text,
	"leftover_of_item_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"week_start_date" text NOT NULL,
	"status" "meal_plan_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"notes" text,
	"pinned_telegram_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"event_date" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"skip_dinner" boolean DEFAULT false NOT NULL,
	"skip_lunch" boolean DEFAULT false NOT NULL,
	"skip_breakfast" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "prep_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cook_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "total_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "leftover_strategy" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "storage_guidance" text;--> statement-breakpoint
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_grocery_list_id_grocery_lists_id_fk" FOREIGN KEY ("grocery_list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_list_items_list_idx" ON "grocery_list_items" USING btree ("grocery_list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_list_items_list_normalized_uidx" ON "grocery_list_items" USING btree ("grocery_list_id","normalized_name");--> statement-breakpoint
CREATE INDEX "grocery_lists_household_status_idx" ON "grocery_lists" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "meal_plan_items_plan_date_idx" ON "meal_plan_items" USING btree ("meal_plan_id","meal_date");--> statement-breakpoint
CREATE INDEX "meal_plans_household_week_idx" ON "meal_plans" USING btree ("household_id","week_start_date");--> statement-breakpoint
CREATE INDEX "meal_plans_household_status_idx" ON "meal_plans" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "schedule_events_household_date_idx" ON "schedule_events" USING btree ("household_id","event_date");