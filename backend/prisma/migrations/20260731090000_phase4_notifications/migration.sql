-- Phase 4: SMS / Email Notification System

CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "notification_logs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(150) NOT NULL,
    "subject" VARCHAR(200),
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(50),
    "error_message" VARCHAR(500),
    "sent_by" INTEGER,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_notification_madrasa_channel_status" ON "notification_logs"("madrasa_id", "channel", "status");
CREATE INDEX "idx_notification_madrasa_created" ON "notification_logs"("madrasa_id", "created_at");

ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
