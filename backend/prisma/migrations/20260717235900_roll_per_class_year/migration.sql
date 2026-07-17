-- Allow the same roll number in different classes or academic years,
-- while preventing duplicates within the same class and academic year.
DROP INDEX IF EXISTS "unique_roll_per_madrasa";

CREATE UNIQUE INDEX "unique_roll_per_class_year"
ON "students"("madrasa_id", "class_id", "academic_year", "roll");
