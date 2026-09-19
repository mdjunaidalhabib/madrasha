-- Per-division fail mark + per-division grade scales.
-- All new columns are NULL for every existing row, meaning "use the
-- madrasa-wide default" - so behaviour is unchanged until an admin sets a
-- division override.
ALTER TABLE "madrasa_divisions" ADD COLUMN "fail_mark" INTEGER;

ALTER TABLE "general_grades" ADD COLUMN "division_id" INTEGER;
ALTER TABLE "madrasa_grades" ADD COLUMN "division_id" INTEGER;

ALTER TABLE "general_grades"
  ADD CONSTRAINT "general_grades_division_id_fkey"
  FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "madrasa_grades"
  ADD CONSTRAINT "madrasa_grades_division_id_fkey"
  FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- (madrasa, name) uniqueness now applies per scope. A plain composite unique
-- index does not dedupe NULL division_id rows, so the madrasa-wide scale gets
-- a partial unique index of its own.
DROP INDEX "uniq_general_grade_madrasa";
DROP INDEX "uniq_madrasa_grade_madrasa";

CREATE UNIQUE INDEX "uniq_general_grade_madrasa" ON "general_grades"("madrasa_id", "division_id", "name");
CREATE UNIQUE INDEX "uniq_madrasa_grade_madrasa" ON "madrasa_grades"("madrasa_id", "division_id", "name");
CREATE UNIQUE INDEX "uniq_general_grade_madrasa_default" ON "general_grades"("madrasa_id", "name") WHERE "division_id" IS NULL;
CREATE UNIQUE INDEX "uniq_madrasa_grade_madrasa_default" ON "madrasa_grades"("madrasa_id", "name") WHERE "division_id" IS NULL;

CREATE INDEX "idx_general_grades_division" ON "general_grades"("madrasa_id", "division_id");
CREATE INDEX "idx_madrasa_grades_division" ON "madrasa_grades"("madrasa_id", "division_id");
