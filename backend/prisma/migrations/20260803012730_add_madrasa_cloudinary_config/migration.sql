-- CreateTable
CREATE TABLE "madrasa_cloudinary_configs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "cloud_name" VARCHAR(100) NOT NULL,
    "api_key" VARCHAR(100) NOT NULL,
    "api_secret_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_cloudinary_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "madrasa_cloudinary_configs_madrasa_id_key" ON "madrasa_cloudinary_configs"("madrasa_id");

-- AddForeignKey
ALTER TABLE "madrasa_cloudinary_configs" ADD CONSTRAINT "madrasa_cloudinary_configs_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
