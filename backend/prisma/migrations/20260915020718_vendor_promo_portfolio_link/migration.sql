/*
  Warnings:

  - You are about to drop the column `detail_link_text` on the `platform_vendor_promo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "platform_vendor_promo" DROP COLUMN "detail_link_text",
ADD COLUMN     "portfolio_url" VARCHAR(300);
