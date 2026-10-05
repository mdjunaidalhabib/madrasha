-- Attendance v3: policy (edit window, late/leave rules, low-attendance and
-- consecutive-absence thresholds), append-only audit trail, leave requests,
-- sub-day sessions. See src/modules/attendance/ATTENDANCE_V3_API.md.

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "edit_window_days" INTEGER NOT NULL DEFAULT 7,
    "late_to_absent_count" INTEGER NOT NULL DEFAULT 0,
    "leave_mode" VARCHAR(16) NOT NULL DEFAULT 'excluded',
    "low_attendance_percent" INTEGER NOT NULL DEFAULT 75,
    "consecutive_absent_days" INTEGER NOT NULL DEFAULT 0,
    "last_consecutive_check" DATE,
    "payroll_deduct_absent" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_changes" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "attendance_id" INTEGER,
    "attendee_type" "AttendeeType" NOT NULL,
    "attendee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "old_status" "AttendanceStatus",
    "new_status" "AttendanceStatus",
    "old_source" VARCHAR(20),
    "new_source" VARCHAR(20),
    "reason" VARCHAR(255),
    "via" VARCHAR(20) NOT NULL,
    "changed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "attendee_type" "AttendeeType" NOT NULL,
    "attendee_id" INTEGER NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "leave_type" VARCHAR(20) NOT NULL DEFAULT 'other',
    "reason" VARCHAR(500) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_via" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "requested_by" INTEGER,
    "guardian_id" INTEGER,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "residential_only" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_attendances" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "class_id" INTEGER,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" VARCHAR(255),
    "marked_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policies_madrasa_id_key" ON "attendance_policies"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_att_change_attendee_date" ON "attendance_changes"("madrasa_id", "attendee_type", "attendee_id", "date");

-- CreateIndex
CREATE INDEX "idx_att_change_madrasa_created" ON "attendance_changes"("madrasa_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_att_change_attendance" ON "attendance_changes"("attendance_id");

-- CreateIndex
CREATE INDEX "idx_leave_madrasa_status" ON "leave_requests"("madrasa_id", "status");

-- CreateIndex
CREATE INDEX "idx_leave_attendee" ON "leave_requests"("madrasa_id", "attendee_type", "attendee_id");

-- CreateIndex
CREATE INDEX "idx_leave_range" ON "leave_requests"("madrasa_id", "from_date", "to_date");

-- CreateIndex
CREATE INDEX "idx_att_session_madrasa" ON "attendance_sessions"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_session_att_madrasa_date" ON "session_attendances"("madrasa_id", "date");

-- CreateIndex
CREATE INDEX "idx_session_att_class_date" ON "session_attendances"("madrasa_id", "class_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_session_attendance" ON "session_attendances"("session_id", "student_id", "date");

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_changes" ADD CONSTRAINT "attendance_changes_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission catalog rows (idempotent; prisma/seed.ts also upserts them).
INSERT INTO "permissions" ("key_name", "name", "updated_at") VALUES
    ('attendance.edit', 'পুরনো/বিদ্যমান উপস্থিতি সংশোধন', CURRENT_TIMESTAMP),
    ('attendance.policy', 'উপস্থিতি নীতি ও সেটিংস', CURRENT_TIMESTAMP),
    ('attendance.leave', 'ছুটির আবেদন ব্যবস্থাপনা', CURRENT_TIMESTAMP),
    ('attendance.session', 'সেশন (আবাসিক) উপস্থিতি ব্যবস্থাপনা', CURRENT_TIMESTAMP)
ON CONFLICT ("key_name") DO NOTHING;
