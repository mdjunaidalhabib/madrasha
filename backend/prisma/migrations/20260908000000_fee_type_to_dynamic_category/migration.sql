-- CreateTable
CREATE TABLE "fee_categories" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_admission_type" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fee_categories_madrasa" ON "fee_categories"("madrasa_id");

-- AddForeignKey
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: fee_structures.fee_type ADMISSION/TUITION/EXAM/BOARDING/OTHER
-- enum -> free-text ফি ধরণ name (see FeeCategory in fee.prisma for why this
-- is no longer an enum/FK - same "plain string picklist" pattern as
-- Account.fund/Account.category). Converted straight to the Bangla display
-- label instead of just the enum's text form, so it lines up 1:1 with the
-- FEE_CATEGORY_DEFAULTS names backfilled into fee_categories below.
ALTER TABLE "fee_structures" ALTER COLUMN "fee_type" DROP DEFAULT;
ALTER TABLE "fee_structures" ALTER COLUMN "fee_type" TYPE VARCHAR(120) USING (
  CASE "fee_type"::text
    WHEN 'ADMISSION' THEN 'ভর্তি ফি'
    WHEN 'TUITION' THEN 'মাসিক বেতন'
    WHEN 'EXAM' THEN 'পরীক্ষার ফি'
    WHEN 'BOARDING' THEN 'বোর্ডিং ফি'
    ELSE 'অন্যান্য'
  END
);
ALTER TABLE "fee_structures" ALTER COLUMN "fee_type" SET DEFAULT 'অন্যান্য';

-- AlterTable: same conversion for the Super Admin's global template table.
ALTER TABLE "default_fee_structures" ALTER COLUMN "fee_type" DROP DEFAULT;
ALTER TABLE "default_fee_structures" ALTER COLUMN "fee_type" TYPE VARCHAR(120) USING (
  CASE "fee_type"::text
    WHEN 'ADMISSION' THEN 'ভর্তি ফি'
    WHEN 'TUITION' THEN 'মাসিক বেতন'
    WHEN 'EXAM' THEN 'পরীক্ষার ফি'
    WHEN 'BOARDING' THEN 'বোর্ডিং ফি'
    ELSE 'অন্যান্য'
  END
);
ALTER TABLE "default_fee_structures" ALTER COLUMN "fee_type" SET DEFAULT 'অন্যান্য';

-- DropEnum
DROP TYPE "FeeType";

-- Backfill: every existing tenant gets the same 5 starter ফি ধরণ categories
-- that used to be the hardcoded enum, so nothing they could previously pick
-- disappears and "ভর্তি ফি" (isAdmissionType) keeps billing at admission
-- submission immediately, with no manual setup required. New tenants created
-- after this migration get the same set lazily on first access - see
-- FeeRepository.seedDefaultCategories/FeeService.getCategories.
INSERT INTO "fee_categories" ("madrasa_id", "name", "is_admission_type", "sort_order", "created_at", "updated_at")
SELECT m.id, v.name, v.is_admission_type, v.sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "madrasas" m
CROSS JOIN (VALUES
  ('ভর্তি ফি', true, 0),
  ('মাসিক বেতন', false, 1),
  ('পরীক্ষার ফি', false, 2),
  ('বোর্ডিং ফি', false, 3),
  ('অন্যান্য', false, 4)
) AS v(name, is_admission_type, sort_order);
