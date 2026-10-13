-- Shrink ResultPublishStatus from the 8-step approval pipeline down to
-- DRAFT / PROCESSING / PUBLISHED. The intermediate states were only
-- informational for a single reviewer who verifies, approves and publishes
-- in one go, so existing rows are collapsed first and the enum is then
-- narrowed.
--
--   PUBLISHED, LOCKED                              -> PUBLISHED
--   PROCESSING, RESULT_VERIFIED, APPROVED          -> PROCESSING
--   DRAFT, MARKS_SUBMITTED, MARKS_VERIFIED         -> DRAFT
--
-- A MARKS_VERIFIED row that becomes DRAFT can still be processed: the
-- "every subject verified" precondition is now read straight from
-- mark_submissions instead of from the master status.
--
-- The submitted_*/marks_verified_*/result_verified_*/approved_*/locked_*
-- columns on results_master are intentionally left in place (no longer
-- written) so historical audit data is preserved.

-- Collapse existing values. Order matters: PUBLISHED first, then PROCESSING,
-- everything left over is DRAFT.
UPDATE "results_master" SET "status" = 'PUBLISHED' WHERE "status" IN ('PUBLISHED', 'LOCKED');
UPDATE "results_master" SET "status" = 'PROCESSING' WHERE "status" IN ('PROCESSING', 'RESULT_VERIFIED', 'APPROVED');
UPDATE "results_master" SET "status" = 'DRAFT' WHERE "status" NOT IN ('PUBLISHED', 'PROCESSING');

-- Rebuild the enum type with only the values that remain in use.
CREATE TYPE "ResultPublishStatus_new" AS ENUM ('DRAFT', 'PROCESSING', 'PUBLISHED');

ALTER TABLE "results_master" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "results_master" ALTER COLUMN "status" TYPE "ResultPublishStatus_new" USING ("status"::text::"ResultPublishStatus_new");
ALTER TABLE "results_master" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "ResultPublishStatus";
ALTER TYPE "ResultPublishStatus_new" RENAME TO "ResultPublishStatus";

-- The result.lock permission only gated the removed /results/:id/lock
-- endpoint. Remove the catalog row and any role grants (role_permissions
-- rows cascade or are cleaned up explicitly below).
DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key_name" = 'result.lock');
DELETE FROM "permissions" WHERE "key_name" = 'result.lock';
