-- Phase 1: Admission Approval, Attendance, Class/Exam Routine, Student Promotion

-- ============================================================
-- ADMISSION APPROVAL WORKFLOW (students table)
-- ============================================================

CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "students"
  ADD COLUMN "admission_status" "AdmissionStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "rejection_reason" VARCHAR(255),
  ADD COLUMN "reviewed_by" INTEGER,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

CREATE INDEX "idx_students_madrasa_admission_status" ON "students"("madrasa_id", "admission_status");

-- ============================================================
-- ATTENDANCE (Student / Teacher / Staff)
-- ============================================================

CREATE TYPE "AttendeeType" AS ENUM ('STUDENT', 'TEACHER', 'STAFF');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE');

CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "attendee_type" "AttendeeType" NOT NULL,
    "attendee_id" INTEGER NOT NULL,
    "class_id" INTEGER,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" VARCHAR(255),
    "marked_by" INTEGER,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_attendance_per_day" ON "attendances"("madrasa_id", "attendee_type", "attendee_id", "date");
CREATE INDEX "idx_attendance_madrasa_date" ON "attendances"("madrasa_id", "date");
CREATE INDEX "idx_attendance_madrasa_class_date" ON "attendances"("madrasa_id", "class_id", "date");
CREATE INDEX "idx_attendance_madrasa_attendee" ON "attendances"("madrasa_id", "attendee_type", "attendee_id");

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- CLASS ROUTINE & EXAM ROUTINE
-- ============================================================

CREATE TABLE "class_routines" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "teacher_id" INTEGER,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_routines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_class_routine_madrasa_class" ON "class_routines"("madrasa_id", "class_id");
CREATE INDEX "idx_class_routine_madrasa_teacher" ON "class_routines"("madrasa_id", "teacher_id");

ALTER TABLE "class_routines" ADD CONSTRAINT "class_routines_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines" ADD CONSTRAINT "class_routines_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines" ADD CONSTRAINT "class_routines_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "exam_routines" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "room_no" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_routines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_exam_routine_madrasa_exam" ON "exam_routines"("madrasa_id", "exam_id");
CREATE INDEX "idx_exam_routine_madrasa_class_date" ON "exam_routines"("madrasa_id", "class_id", "exam_date");

ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- STUDENT PROMOTION
-- ============================================================

CREATE TYPE "PromotionRecordStatus" AS ENUM ('PROMOTED', 'RETAINED', 'TRANSFERRED');

CREATE TABLE "promotion_batches" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "from_class_id" INTEGER NOT NULL,
    "to_class_id" INTEGER NOT NULL,
    "from_year" VARCHAR(10) NOT NULL,
    "to_year" VARCHAR(10) NOT NULL,
    "promoted_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_promotion_batch_madrasa_years" ON "promotion_batches"("madrasa_id", "from_year", "to_year");

ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promotion_records" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "old_roll" INTEGER NOT NULL,
    "new_roll" INTEGER,
    "status" "PromotionRecordStatus" NOT NULL,

    CONSTRAINT "promotion_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_promotion_record_batch" ON "promotion_records"("batch_id");
CREATE INDEX "idx_promotion_record_student" ON "promotion_records"("student_id");

ALTER TABLE "promotion_records" ADD CONSTRAINT "promotion_records_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "promotion_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_records" ADD CONSTRAINT "promotion_records_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
