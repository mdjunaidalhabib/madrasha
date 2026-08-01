-- CreateEnum
CREATE TYPE "WebsiteAdmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "website_settings" ADD COLUMN     "muhtamim_designation" VARCHAR(190),
ADD COLUMN     "muhtamim_message" TEXT,
ADD COLUMN     "muhtamim_name" VARCHAR(190),
ADD COLUMN     "muhtamim_photo" VARCHAR(255),
ADD COLUMN     "show_committee" INTEGER DEFAULT 1,
ADD COLUMN     "show_muhtamim" INTEGER DEFAULT 1,
ADD COLUMN     "show_notice_bar" INTEGER DEFAULT 1,
ADD COLUMN     "show_slider" INTEGER DEFAULT 1;

-- CreateTable
CREATE TABLE "website_slides" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(190),
    "subtitle" VARCHAR(255),
    "image_url" VARCHAR(255) NOT NULL,
    "button_text" VARCHAR(60),
    "button_link" VARCHAR(255),
    "is_published" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_committee_members" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "designation" VARCHAR(190),
    "photo_url" VARCHAR(255),
    "phone" VARCHAR(20),
    "is_published" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_admission_applications" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "student_name" VARCHAR(190) NOT NULL,
    "father_name" VARCHAR(190),
    "mother_name" VARCHAR(190),
    "gender" VARCHAR(10),
    "date_of_birth" DATE,
    "class_applied" VARCHAR(100),
    "guardian_phone" VARCHAR(20),
    "address" TEXT,
    "note" TEXT,
    "status" "WebsiteAdmissionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_admission_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_website_slides_madrasa" ON "website_slides"("madrasa_id", "is_published", "sort_order");

-- CreateIndex
CREATE INDEX "idx_website_committee_madrasa" ON "website_committee_members"("madrasa_id", "is_published", "sort_order");

-- CreateIndex
CREATE INDEX "idx_website_admission_madrasa" ON "website_admission_applications"("madrasa_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "website_slides" ADD CONSTRAINT "website_slides_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_committee_members" ADD CONSTRAINT "website_committee_members_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_admission_applications" ADD CONSTRAINT "website_admission_applications_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
