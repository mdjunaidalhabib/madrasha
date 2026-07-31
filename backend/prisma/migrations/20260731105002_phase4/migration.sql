/*
  Warnings:

  - You are about to drop the column `method_type` on the `payment_method_settings` table. All the data in the column will be lost.
  - Added the required column `methodType` to the `payment_method_settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment_method_settings" DROP COLUMN "method_type",
ADD COLUMN     "methodType" VARCHAR(20) NOT NULL;
