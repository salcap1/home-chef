CREATE TYPE "public"."meal_feedback_sentiment" AS ENUM('loved', 'liked', 'okay', 'disliked', 'never_again');--> statement-breakpoint
CREATE TYPE "public"."meal_feedback_target" AS ENUM('meal', 'recipe', 'ingredient', 'sauce', 'method', 'other');--> statement-breakpoint
ALTER TYPE "public"."inventory_event_type" ADD VALUE 'cooked' BEFORE 'consumed';--> statement-breakpoint
ALTER TYPE "public"."inventory_event_type" ADD VALUE 'expired' BEFORE 'adjusted';--> statement-breakpoint
ALTER TYPE "public"."inventory_event_type" ADD VALUE 'converted_to_leftover' BEFORE 'adjusted';--> statement-breakpoint
CREATE TABLE "leftovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"servings_text" text,
	"servings_value" numeric(12, 3),
	"source_meal_name" text,
	"notes" text,
	"use_soon" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid,
	"meal_history_id" uuid,
	"member_id" uuid,
	"sentiment" "meal_feedback_sentiment" NOT NULL,
	"target" "meal_feedback_target" DEFAULT 'meal' NOT NULL,
	"target_detail" text,
	"feedback_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid,
	"member_id" uuid,
	"name" text NOT NULL,
	"meal_type" text DEFAULT 'dinner' NOT NULL,
	"servings_text" text,
	"was_planned" boolean DEFAULT false NOT NULL,
	"actually_cooked" boolean DEFAULT true NOT NULL,
	"notes" text,
	"cooked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"servings" integer,
	"summary" text,
	"ingredients_text" text,
	"instructions_text" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"times_cooked" integer DEFAULT 0 NOT NULL,
	"last_cooked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "use_soon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "acquired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leftovers" ADD CONSTRAINT "leftovers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_meal_history_id_meal_history_id_fk" FOREIGN KEY ("meal_history_id") REFERENCES "public"."meal_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_feedback" ADD CONSTRAINT "meal_feedback_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_history" ADD CONSTRAINT "meal_history_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_history" ADD CONSTRAINT "meal_history_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_history" ADD CONSTRAINT "meal_history_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_notes" ADD CONSTRAINT "recipe_notes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_notes" ADD CONSTRAINT "recipe_notes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leftovers_household_id_idx" ON "leftovers" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "leftovers_active_idx" ON "leftovers" USING btree ("household_id","is_active");--> statement-breakpoint
CREATE INDEX "meal_feedback_household_created_idx" ON "meal_feedback" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "meal_history_household_cooked_idx" ON "meal_history" USING btree ("household_id","cooked_at");--> statement-breakpoint
CREATE INDEX "recipe_notes_recipe_id_idx" ON "recipe_notes" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_household_normalized_name_uidx" ON "recipes" USING btree ("household_id","normalized_name");--> statement-breakpoint
CREATE INDEX "recipes_household_favorite_idx" ON "recipes" USING btree ("household_id","is_favorite");