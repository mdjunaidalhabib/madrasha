-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('ADMISSION', 'TUITION', 'EXAM', 'BOARDING', 'OTHER');

-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "fee_type" "FeeType" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "default_fee_structures" ADD COLUMN     "fee_type" "FeeType" NOT NULL DEFAULT 'OTHER';

-- Best-effort backfill for existing rows, matching the naming convention
-- seed.ts already uses for the platform default-fee templates and the
-- admission-fee-only-at-submission-time feature (see FeeService /
-- StudentService). Anything not matched stays 'OTHER' - admins can
-- reclassify custom-named fees from ফি সেটাপ afterward.
UPDATE "fee_structures" SET "fee_type" = 'ADMISSION' WHERE "name" ILIKE '%ভর্তি%';
UPDATE "fee_structures" SET "fee_type" = 'TUITION' WHERE "name" ILIKE '%বেতন%';
UPDATE "fee_structures" SET "fee_type" = 'EXAM' WHERE "name" ILIKE '%পরীক্ষা%';
UPDATE "fee_structures" SET "fee_type" = 'BOARDING' WHERE "name" ILIKE '%বোর্ডিং%';

UPDATE "default_fee_structures" SET "fee_type" = 'ADMISSION' WHERE "key_name" LIKE 'admission_%';
UPDATE "default_fee_structures" SET "fee_type" = 'TUITION' WHERE "key_name" LIKE 'tuition_%';
UPDATE "default_fee_structures" SET "fee_type" = 'EXAM' WHERE "key_name" LIKE 'exam_%';
UPDATE "default_fee_structures" SET "fee_type" = 'BOARDING' WHERE "key_name" LIKE 'boarding_%';
