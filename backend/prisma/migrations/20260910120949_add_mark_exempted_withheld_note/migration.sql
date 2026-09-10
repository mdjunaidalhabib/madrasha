-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "is_exempted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_withheld" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT;
