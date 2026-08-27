-- CreateTable
CREATE TABLE "platform_vendor_promo" (
    "id" SERIAL NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_vendor_promo_pkey" PRIMARY KEY ("id")
);
