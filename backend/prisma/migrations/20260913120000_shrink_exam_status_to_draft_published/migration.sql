-- Shrink ExamStatus from the unused 12-step pipeline down to just
-- DRAFT / PUBLISHED. Nothing in the app gates behavior on the
-- intermediate values (PLANNED, REGISTRATION_OPEN, ..., RESULT_APPROVAL,
-- LOCKED, CANCELLED) - it was an informational label only - so existing
-- rows are collapsed down before the type itself is narrowed.

-- Collapse existing values: anything that had reached PUBLISHED or LOCKED
-- becomes PUBLISHED, everything else (DRAFT and all the intermediate
-- steps) becomes DRAFT.
UPDATE "exams" SET "status" = 'PUBLISHED' WHERE "status" IN ('PUBLISHED', 'LOCKED');
UPDATE "exams" SET "status" = 'DRAFT' WHERE "status" NOT IN ('PUBLISHED');

-- Rebuild the enum type with only the two values that remain in use.
CREATE TYPE "ExamStatus_new" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "exams" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "exams" ALTER COLUMN "status" TYPE "ExamStatus_new" USING ("status"::text::"ExamStatus_new");
ALTER TABLE "exams" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "ExamStatus";
ALTER TYPE "ExamStatus_new" RENAME TO "ExamStatus";
