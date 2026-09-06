-- Roll is now assigned only when a Muhtamim approves an admission (see
-- StudentService.approveAdmission), not at submission time. Applications
-- that are PENDING or REJECTED therefore no longer occupy a roll number.

-- 1) Allow NULL so an in-review/rejected application can have no roll yet.
--    (Postgres treats every NULL as distinct, so this can never collide
--    with the existing `unique_roll_per_class_session` constraint.)
ALTER TABLE "students" ALTER COLUMN "roll" DROP NOT NULL;

-- 2) Backfill: free the roll held by every already-PENDING or already-
--    REJECTED row created under the old behaviour, so numbers stuck behind
--    an old cancelled/pending application become available again right
--    away instead of only for admissions submitted from now on.
UPDATE "students"
SET "roll" = NULL
WHERE "admission_status" IN ('PENDING', 'REJECTED');
