-- AlterEnum
ALTER TYPE "ResultRowStatus" ADD VALUE 'ABSENT';

-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "is_absent" BOOLEAN NOT NULL DEFAULT false;
