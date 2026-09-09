/*
  Warnings:

  - You are about to drop the `madrasa_cloudinary_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "madrasa_cloudinary_configs" DROP CONSTRAINT "madrasa_cloudinary_configs_madrasa_id_fkey";

-- DropTable
DROP TABLE "madrasa_cloudinary_configs";
