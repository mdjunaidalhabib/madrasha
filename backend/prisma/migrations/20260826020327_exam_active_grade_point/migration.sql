-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "general_grades" ADD COLUMN     "point" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "madrasa_grades" ADD COLUMN     "point" DOUBLE PRECISION;
