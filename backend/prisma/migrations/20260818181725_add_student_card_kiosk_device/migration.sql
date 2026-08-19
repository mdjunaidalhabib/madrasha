-- AlterTable
ALTER TABLE "students" ADD COLUMN     "card_uid" VARCHAR(64),
ADD COLUMN     "fingerprint_id" VARCHAR(100);

-- CreateTable
CREATE TABLE "kiosk_devices" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "api_key_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_devices_api_key_hash_key" ON "kiosk_devices"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_kiosk_devices_madrasa" ON "kiosk_devices"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_card_uid_key" ON "students"("card_uid");

-- CreateIndex
CREATE UNIQUE INDEX "students_fingerprint_id_key" ON "students"("fingerprint_id");

-- AddForeignKey
ALTER TABLE "kiosk_devices" ADD CONSTRAINT "kiosk_devices_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

