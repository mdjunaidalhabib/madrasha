-- Registration number is now assigned only when a Muhtamim approves an
-- admission (see StudentService.approveAdmission), not at submission time -
-- same change already made for `roll` in
-- 20260830000000_roll_assigned_only_on_admission_approval. Applications
-- that are PENDING or REJECTED therefore no longer occupy a registration
-- number.

-- 1) Allow NULL so an in-review/rejected application can have none yet.
--    (Postgres treats every NULL as distinct, so this can never collide
--    with the existing `uniq_registration_no` constraint.)
ALTER TABLE "students" ALTER COLUMN "registration_no" DROP NOT NULL;

-- 2) Backfill: free the registration number held by every already-PENDING
--    or already-REJECTED row created under the old behaviour, so numbers
--    stuck behind an old cancelled/pending application become available
--    again right away instead of only for admissions submitted from now on.
UPDATE "students"
SET "registration_no" = NULL
WHERE "admission_status" IN ('PENDING', 'REJECTED');
