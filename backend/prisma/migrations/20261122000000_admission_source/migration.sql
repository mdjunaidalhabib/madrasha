ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admission_source" VARCHAR(20);

-- Recover a legacy source only when the most recent single-admission log
-- belongs to this tenant and follows the student's latest write. This
-- excludes stale logs superseded by a bulk admission or profile change.
WITH latest_admission AS (
  SELECT DISTINCT ON ("madrasa_id", "entity_id")
    "madrasa_id", "entity_id", "user_id", "created_at"
  FROM "activity_logs"
  WHERE "entity" = 'students/admission' AND "action" = 'CREATE'
    AND "entity_id" IS NOT NULL
  ORDER BY "madrasa_id", "entity_id", "created_at" DESC, "id" DESC
)
UPDATE "students" AS student
SET "admission_source" = CASE WHEN entry."user_id" IS NULL THEN 'WEBSITE' ELSE 'ADMIN' END
FROM latest_admission AS entry
WHERE student."id" = entry."entity_id" AND student."madrasa_id" = entry."madrasa_id"
  AND student."admission_source" IS NULL
  AND entry."created_at" >= student."updated_at";
