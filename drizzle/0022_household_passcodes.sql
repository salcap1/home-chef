ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "passcode_lookup" text;-->statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "monthly_budget_usd" numeric(12, 2);-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "households_passcode_lookup_uidx" ON "households" ("passcode_lookup");
