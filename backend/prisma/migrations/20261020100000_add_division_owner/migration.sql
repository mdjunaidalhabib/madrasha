-- Private divisions. A madrasa can now add/duplicate its own বিভাগ from
-- তালিমাত সেটিংস. Like private classes/books, owner_madrasa_id marks them so
-- they never leak into the shared Super Admin catalogue.
ALTER TABLE "divisions" ADD COLUMN IF NOT EXISTS "owner_madrasa_id" INTEGER;
CREATE INDEX IF NOT EXISTS "idx_divisions_owner" ON "divisions"("owner_madrasa_id");
