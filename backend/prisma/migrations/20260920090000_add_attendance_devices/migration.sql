-- ZKTeco K40 attendance device integration (additive only: new tables, one
-- new nullable column, two permission rows). Safe to deploy before the code.

-- CreateEnum
CREATE TYPE "DeviceLogSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "check_in_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "attendance_devices" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "device_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ip_address" VARCHAR(100) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "comm_password" VARCHAR(500),
    "api_key_hash" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
    "last_seen_at" TIMESTAMPTZ(3),
    "last_device_contact_at" TIMESTAMPTZ(3),
    "last_sync_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(255),
    "connector_version" VARCHAR(32),
    "poll_interval_sec" INTEGER NOT NULL DEFAULT 30,
    "test_requested_at" TIMESTAMPTZ(3),
    "last_test_at" TIMESTAMPTZ(3),
    "last_test_ok" BOOLEAN,
    "last_test_message" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_device_user_maps" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "device_user_id" VARCHAR(64) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_device_user_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_device_logs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "device_user_id" VARCHAR(64) NOT NULL,
    "punched_at" TIMESTAMPTZ(3) NOT NULL,
    "verify_type" VARCHAR(32),
    "in_out_state" VARCHAR(32),
    "student_id" INTEGER,
    "attendance_id" INTEGER,
    "sync_status" "DeviceLogSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fail_reason" VARCHAR(255),

    CONSTRAINT "attendance_device_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_queue" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "dedupe_key" VARCHAR(191) NOT NULL,
    "recipient" VARCHAR(30) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SmsQueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(3),
    "source" VARCHAR(30) NOT NULL DEFAULT 'attendance',
    "student_id" INTEGER,
    "attendance_id" INTEGER,
    "for_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_api_key_hash_key" ON "attendance_devices"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_att_devices_madrasa" ON "attendance_devices"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_code" ON "attendance_devices"("madrasa_id", "device_code");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_map_user" ON "attendance_device_user_maps"("madrasa_id", "device_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_map_student" ON "attendance_device_user_maps"("madrasa_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_att_log_madrasa_punched" ON "attendance_device_logs"("madrasa_id", "punched_at");

-- CreateIndex
CREATE INDEX "idx_att_log_student_punched" ON "attendance_device_logs"("madrasa_id", "student_id", "punched_at");

-- CreateIndex
CREATE INDEX "idx_att_log_user_student" ON "attendance_device_logs"("madrasa_id", "device_user_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_log_event" ON "attendance_device_logs"("madrasa_id", "device_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_log_punch" ON "attendance_device_logs"("madrasa_id", "device_id", "device_user_id", "punched_at");

-- CreateIndex
CREATE UNIQUE INDEX "sms_queue_dedupe_key_key" ON "sms_queue"("dedupe_key");

-- CreateIndex
CREATE INDEX "idx_sms_queue_status_next" ON "sms_queue"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "idx_sms_queue_madrasa_date" ON "sms_queue"("madrasa_id", "for_date");

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_user_maps" ADD CONSTRAINT "attendance_device_user_maps_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_user_maps" ADD CONSTRAINT "attendance_device_user_maps_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_logs" ADD CONSTRAINT "attendance_device_logs_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_logs" ADD CONSTRAINT "attendance_device_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_logs" ADD CONSTRAINT "attendance_device_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission catalog rows (idempotent; prisma/seed.ts also upserts them).
INSERT INTO "permissions" ("key_name", "name", "updated_at") VALUES
    ('attendance_device.manage', 'বায়োমেট্রিক ডিভাইস ব্যবস্থাপনা', CURRENT_TIMESTAMP),
    ('attendance_device.view', 'বায়োমেট্রিক ডিভাইস ও উপস্থিতি দেখুন', CURRENT_TIMESTAMP)
ON CONFLICT ("key_name") DO NOTHING;
