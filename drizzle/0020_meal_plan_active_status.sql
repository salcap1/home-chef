-- Shrink meal_plan_status to active | completed (drop draft/discussing/locked).
ALTER TYPE "public"."meal_plan_status" RENAME TO "meal_plan_status_old";--> statement-breakpoint
CREATE TYPE "public"."meal_plan_status" AS ENUM('active', 'completed');--> statement-breakpoint
ALTER TABLE "meal_plans" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meal_plans" ALTER COLUMN "status" TYPE "public"."meal_plan_status" USING (
  CASE
    WHEN "status"::text = 'completed' THEN 'completed'::"public"."meal_plan_status"
    ELSE 'active'::"public"."meal_plan_status"
  END
);--> statement-breakpoint
ALTER TABLE "meal_plans" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."meal_plan_status";--> statement-breakpoint
DROP TYPE "public"."meal_plan_status_old";
