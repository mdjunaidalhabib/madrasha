-- AlterTable
ALTER TABLE "madrasas" ADD COLUMN "branding_phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "branding_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
