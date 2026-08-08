-- CreateTable
CREATE TABLE "platform_cloudinary_configs" (
    "id" SERIAL NOT NULL,
    "cloud_name" VARCHAR(100) NOT NULL,
    "api_key" VARCHAR(100) NOT NULL,
    "api_secret_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_cloudinary_configs_pkey" PRIMARY KEY ("id")
);
