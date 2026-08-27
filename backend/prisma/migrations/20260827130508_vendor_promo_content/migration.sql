-- AlterTable
ALTER TABLE "platform_vendor_promo"
ADD COLUMN     "company_name" VARCHAR(150),
ADD COLUMN     "tagline" VARCHAR(200),
ADD COLUMN     "teaser_text" VARCHAR(300),
ADD COLUMN     "detail_link_text" VARCHAR(60),
ADD COLUMN     "hero_title" VARCHAR(200),
ADD COLUMN     "hero_text" TEXT,
ADD COLUMN     "founder_name" VARCHAR(150),
ADD COLUMN     "founder_title" VARCHAR(100),
ADD COLUMN     "founder_location" VARCHAR(150),
ADD COLUMN     "founder_bio" TEXT,
ADD COLUMN     "founder_skills" VARCHAR(300),
ADD COLUMN     "founder_photo_url" VARCHAR(500),
ADD COLUMN     "founder_facebook_url" VARCHAR(300),
ADD COLUMN     "phone_display" VARCHAR(30),
ADD COLUMN     "phone_intl" VARCHAR(30),
ADD COLUMN     "email" VARCHAR(200),
ADD COLUMN     "website" VARCHAR(200),
ADD COLUMN     "address" VARCHAR(250);

-- CreateTable
CREATE TABLE "platform_vendor_services" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "desc" VARCHAR(300),
    "icon_key" VARCHAR(50) NOT NULL DEFAULT 'Sparkles',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_vendor_services_pkey" PRIMARY KEY ("id")
);
