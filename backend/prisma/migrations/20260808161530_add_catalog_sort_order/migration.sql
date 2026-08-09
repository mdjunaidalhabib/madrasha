-- AlterTable
ALTER TABLE "books" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "divisions" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;
