-- Admission form extra fields (previous institution/result, blood group,
-- residency, orphan status, second guardian phone, alternate guardian,
-- and auto-detected admission type)

CREATE TYPE "AdmissionType" AS ENUM ('NEW', 'RE_ADMISSION');

ALTER TABLE "students"
  ADD COLUMN "previous_institution" VARCHAR(200),
  ADD COLUMN "previous_result" VARCHAR(100),
  ADD COLUMN "blood_group" VARCHAR(5),
  ADD COLUMN "residency_type" INTEGER,
  ADD COLUMN "is_orphan" INTEGER DEFAULT 0,
  ADD COLUMN "guardian_phone_2" VARCHAR(20),
  ADD COLUMN "alt_guardian_name" VARCHAR(200),
  ADD COLUMN "alt_guardian_relation" VARCHAR(100),
  ADD COLUMN "alt_guardian_address" VARCHAR(255),
  ADD COLUMN "alt_guardian_phone" VARCHAR(20),
  ADD COLUMN "admission_type" "AdmissionType" NOT NULL DEFAULT 'NEW';
