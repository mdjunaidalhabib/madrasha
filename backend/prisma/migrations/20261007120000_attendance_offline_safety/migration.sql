-- Offline-safe auto absent + manual-mark SMS.
ALTER TABLE "attendance_devices" ADD COLUMN "queue_pending" INTEGER;
ALTER TABLE "attendance_device_settings" ADD COLUMN "auto_absent_max_wait_minutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "attendance_device_settings" ADD COLUMN "manual_sms" BOOLEAN NOT NULL DEFAULT false;
