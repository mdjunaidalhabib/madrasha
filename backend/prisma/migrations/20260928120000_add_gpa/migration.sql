-- Board-style GPA for school/college tenants.
ALTER TABLE "madrasa_books" ADD COLUMN IF NOT EXISTS "is_optional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "results_summary" ADD COLUMN IF NOT EXISTS "gpa" DOUBLE PRECISION;
ALTER TABLE "default_general_grades" ADD COLUMN IF NOT EXISTS "point" DOUBLE PRECISION;

-- Standard Bangladesh grade points for the seeded default scale.
UPDATE "default_general_grades" SET "point" = 5   WHERE "key_name" = 'a_plus'  AND "point" IS NULL;
UPDATE "default_general_grades" SET "point" = 4   WHERE "key_name" = 'a'       AND "point" IS NULL;
UPDATE "default_general_grades" SET "point" = 3.5 WHERE "key_name" = 'a_minus' AND "point" IS NULL;
UPDATE "default_general_grades" SET "point" = 3   WHERE "key_name" = 'b'       AND "point" IS NULL;
UPDATE "default_general_grades" SET "point" = 2   WHERE "key_name" = 'c'       AND "point" IS NULL;
UPDATE "default_general_grades" SET "point" = 1   WHERE "key_name" = 'd'       AND "point" IS NULL;
