-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "event_key" VARCHAR(30) NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "is_enabled" INTEGER NOT NULL DEFAULT 1,
    "template" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_notification_setting_event" ON "notification_settings"("madrasa_id", "event_key");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

