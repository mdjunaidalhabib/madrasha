-- Multi-institution support: a tenant can now be a madrasa, school, college
-- or kindergarten, and has a super-admin controlled default UI language.
DO $$ BEGIN
  CREATE TYPE "InstitutionType" AS ENUM ('MADRASA', 'SCHOOL', 'COLLEGE', 'KINDERGARTEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "madrasas" ADD COLUMN IF NOT EXISTS "institution_type" "InstitutionType" NOT NULL DEFAULT 'MADRASA';
ALTER TABLE "madrasas" ADD COLUMN IF NOT EXISTS "default_language" VARCHAR(5);

-- Catalogue divisions are tagged by institution type; every existing one is a
-- madrasa division.
ALTER TABLE "divisions" ADD COLUMN IF NOT EXISTS "institution_type" "InstitutionType" NOT NULL DEFAULT 'MADRASA';
CREATE INDEX IF NOT EXISTS "idx_divisions_institution_type" ON "divisions"("institution_type");
