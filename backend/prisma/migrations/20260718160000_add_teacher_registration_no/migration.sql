-- Add a permanent, per-madrasa registration number for teachers, mirroring
-- the student registration_no fix (see 20260718120000_add_registration_no
-- and 20260718130000_enforce_auto_student_numbers). The UI previously showed
-- the internal auto-increment `id` as the teacher's "ID", which is global
-- (not per-madrasa), can leave gaps on deletion, and isn't a stable number
-- meant for official documents.
ALTER TABLE "teachers" ADD COLUMN "registration_no" INTEGER;

-- Backfill existing teachers with a sequential number per madrasa, ordered
-- by original creation (id), so current records get stable, predictable
-- numbers starting at 1 for each madrasa.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY id ASC) AS rn
  FROM teachers
)
UPDATE teachers t
SET registration_no = numbered.rn
FROM numbered
WHERE t.id = numbered.id;

ALTER TABLE teachers ALTER COLUMN registration_no SET NOT NULL;

CREATE UNIQUE INDEX "uniq_teacher_registration_no" ON "teachers"("madrasa_id", "registration_no");
