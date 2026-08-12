-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'WAIVED';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "waive_reason" VARCHAR(300),
ADD COLUMN     "waived_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "waived_at" TIMESTAMP(3),
ADD COLUMN     "waived_by" INTEGER;
