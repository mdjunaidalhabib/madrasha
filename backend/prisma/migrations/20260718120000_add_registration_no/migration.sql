-- Add a permanent, per-madrasa registration/admission number for students.
-- Previously the UI showed the internal auto-increment `id` as the
-- "registration number", which is global (not per-madrasa), can leave gaps
-- on deletion, and isn't a stable identifier meant for official documents.
ALTER TABLE "students" ADD COLUMN "registration_no" INTEGER;

-- Backfill existing students with a sequential number per madrasa, ordered
-- by original admission (id), so current records get stable, predictable
-- numbers starting at 1 for each madrasa.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY id ASC) AS rn
  FROM students
)
UPDATE students s
SET registration_no = numbered.rn
FROM numbered
WHERE s.id = numbered.id;

CREATE UNIQUE INDEX "uniq_registration_no" ON "students"("madrasa_id", "registration_no");
