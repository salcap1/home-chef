-- Merge preference notes into value, then drop the notes column.
UPDATE "preferences"
SET "value" = CASE
  WHEN "notes" IS NULL OR btrim("notes") = '' THEN "value"
  WHEN "value" IS NULL OR btrim("value") = '' THEN btrim("notes")
  WHEN position(btrim("notes") in "value") > 0 THEN "value"
  ELSE "value" || E'\n' || btrim("notes")
END
WHERE "notes" IS NOT NULL AND btrim("notes") <> '';
--> statement-breakpoint
ALTER TABLE "preferences" DROP COLUMN IF EXISTS "notes";
