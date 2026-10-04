-- Attendance device v2: system-assigned K40 PINs for students/teachers/staff,
-- RFID card enrollment ("tap the card on the machine"), late / auto-absent /
-- check-out rules, holidays, device offline alert, clock-drift + user-sync
-- telemetry. See src/modules/attendance-device/API.md.

-- CreateEnum
CREATE TYPE "DeviceEnrollmentStatus" AS ENUM ('PENDING', 'WAITING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "attendance_devices" ADD COLUMN     "clock_drift_sec" INTEGER,
ADD COLUMN     "device_user_count" INTEGER,
ADD COLUMN     "last_user_sync_at" TIMESTAMPTZ(3),
ADD COLUMN     "offline_alerted_at" TIMESTAMPTZ(3),
ADD COLUMN     "user_sync_error" VARCHAR(255),
ADD COLUMN     "users_synced_version" VARCHAR(64);

-- AlterTable
ALTER TABLE "attendance_device_user_maps" ADD COLUMN     "attendee_type" "AttendeeType" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "auto_assigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "card_number" VARCHAR(32),
ADD COLUMN     "previous_device_user_id" VARCHAR(64),
ADD COLUMN     "staff_id" INTEGER,
ADD COLUMN     "teacher_id" INTEGER,
ALTER COLUMN "student_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "attendance_device_logs" ADD COLUMN     "staff_id" INTEGER,
ADD COLUMN     "teacher_id" INTEGER;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "check_out_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "attendance_device_enrollments" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "attendee_type" "AttendeeType" NOT NULL,
    "attendee_id" INTEGER NOT NULL,
    "device_user_id" VARCHAR(64) NOT NULL,
    "status" "DeviceEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "card_number" VARCHAR(32),
    "message" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_device_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_device_settings" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "late_enabled" BOOLEAN NOT NULL DEFAULT false,
    "student_start_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "teacher_start_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "auto_absent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "absent_cutoff_time" VARCHAR(5) NOT NULL DEFAULT '10:30',
    "last_auto_absent_date" DATE,
    "checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "checkout_after_time" VARCHAR(5) NOT NULL DEFAULT '12:00',
    "weekly_off_days" INTEGER[] DEFAULT ARRAY[5]::INTEGER[],
    "offline_alert_enabled" BOOLEAN NOT NULL DEFAULT false,
    "offline_alert_minutes" INTEGER NOT NULL DEFAULT 15,
    "alert_phone" VARCHAR(20),
    "auto_time_sync" BOOLEAN NOT NULL DEFAULT true,
    "pin_mode" VARCHAR(16) NOT NULL DEFAULT 'registration',
    "pin_start" INTEGER NOT NULL DEFAULT 10001,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_device_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_holidays" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_att_enroll_device_status" ON "attendance_device_enrollments"("madrasa_id", "device_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_device_settings_madrasa_id_key" ON "attendance_device_settings"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_holiday_date" ON "attendance_holidays"("madrasa_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_map_teacher" ON "attendance_device_user_maps"("madrasa_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_map_staff" ON "attendance_device_user_maps"("madrasa_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_att_device_map_card" ON "attendance_device_user_maps"("madrasa_id", "card_number");

-- AddForeignKey
ALTER TABLE "attendance_device_user_maps" ADD CONSTRAINT "attendance_device_user_maps_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_user_maps" ADD CONSTRAINT "attendance_device_user_maps_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_enrollments" ADD CONSTRAINT "attendance_device_enrollments_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_enrollments" ADD CONSTRAINT "attendance_device_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_settings" ADD CONSTRAINT "attendance_device_settings_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_holidays" ADD CONSTRAINT "attendance_holidays_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one person column is set, matching attendee_type.
ALTER TABLE "attendance_device_user_maps" ADD CONSTRAINT "chk_att_device_map_attendee" CHECK (
  ("attendee_type" = 'STUDENT' AND "student_id" IS NOT NULL AND "teacher_id" IS NULL AND "staff_id" IS NULL) OR
  ("attendee_type" = 'TEACHER' AND "teacher_id" IS NOT NULL AND "student_id" IS NULL AND "staff_id" IS NULL) OR
  ("attendee_type" = 'STAFF'   AND "staff_id"   IS NOT NULL AND "student_id" IS NULL AND "teacher_id" IS NULL)
);
