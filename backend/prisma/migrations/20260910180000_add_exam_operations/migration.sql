-- Hand-written migration (not `prisma migrate dev`): the live database has
-- drift against migration history from concurrent work, and `migrate dev`'s
-- shadow-database diff proposed dropping nearly every table in the
-- database. This file was written by hand to add ONLY the new Exam
-- Operations tables/columns, verified against `prisma validate` for the
-- corresponding schema, and is applied out-of-band (via `prisma db
-- execute`) then reconciled into `_prisma_migrations` with
-- `prisma migrate resolve --applied`, without ever invoking `migrate dev`'s
-- destructive diff/reset path.

-- CreateEnum
CREATE TYPE "ExamRoutineStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvigilatorType" AS ENUM ('TEACHER', 'STAFF');

-- CreateEnum
CREATE TYPE "InvigilatorRole" AS ENUM ('CHIEF', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "InvigilatorAssignmentStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SeatAllocationStrategy" AS ENUM ('SEQUENTIAL', 'ROLL_BASED', 'ALTERNATING', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExamAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'WITHHELD');

-- CreateTable
CREATE TABLE "exam_rooms" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "floor" VARCHAR(50),
    "location" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_exam_room_madrasa_code" ON "exam_rooms"("madrasa_id", "code");
CREATE INDEX "idx_exam_room_madrasa_active" ON "exam_rooms"("madrasa_id", "is_active");

-- AlterTable: ExamRoutine additions (all nullable or defaulted - no risk to
-- existing rows)
ALTER TABLE "exam_routines"
  ADD COLUMN "division_id" INTEGER,
  ADD COLUMN "room_id" INTEGER,
  ADD COLUMN "max_capacity" INTEGER,
  ADD COLUMN "status" "ExamRoutineStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "instructions" VARCHAR(1000);

CREATE INDEX "idx_exam_routine_madrasa_room_date" ON "exam_routines"("madrasa_id", "room_id", "exam_date");

ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "exam_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "exam_invigilator_assignments" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_routine_id" INTEGER NOT NULL,
    "invigilator_type" "InvigilatorType" NOT NULL,
    "invigilator_id" INTEGER NOT NULL,
    "role" "InvigilatorRole" NOT NULL DEFAULT 'ASSISTANT',
    "status" "InvigilatorAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" VARCHAR(300),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_invigilator_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_invigilator_per_slot" ON "exam_invigilator_assignments"("exam_routine_id", "invigilator_type", "invigilator_id");
CREATE INDEX "idx_invigilator_madrasa_routine" ON "exam_invigilator_assignments"("madrasa_id", "exam_routine_id");
CREATE INDEX "idx_invigilator_madrasa_person" ON "exam_invigilator_assignments"("madrasa_id", "invigilator_type", "invigilator_id");

ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_exam_routine_id_fkey"
  FOREIGN KEY ("exam_routine_id") REFERENCES "exam_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "exam_seat_allocations" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_routine_id" INTEGER NOT NULL,
    "exam_candidate_id" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "seat_no" VARCHAR(20) NOT NULL,
    "row_no" INTEGER,
    "column_no" INTEGER,
    "strategy" "SeatAllocationStrategy" NOT NULL DEFAULT 'MANUAL',
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_seat_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_seat_per_candidate_per_slot" ON "exam_seat_allocations"("exam_routine_id", "exam_candidate_id");
CREATE UNIQUE INDEX "uniq_seat_no_per_room_per_slot" ON "exam_seat_allocations"("exam_routine_id", "room_id", "seat_no");
CREATE INDEX "idx_seat_madrasa_routine" ON "exam_seat_allocations"("madrasa_id", "exam_routine_id");
CREATE INDEX "idx_seat_madrasa_room" ON "exam_seat_allocations"("madrasa_id", "room_id");
CREATE INDEX "idx_seat_exam_candidate" ON "exam_seat_allocations"("exam_candidate_id");

ALTER TABLE "exam_seat_allocations" ADD CONSTRAINT "exam_seat_allocations_exam_routine_id_fkey"
  FOREIGN KEY ("exam_routine_id") REFERENCES "exam_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seat_allocations" ADD CONSTRAINT "exam_seat_allocations_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "exam_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "exam_attendances" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_routine_id" INTEGER NOT NULL,
    "exam_candidate_id" INTEGER NOT NULL,
    "room_id" INTEGER,
    "status" "ExamAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remarks" VARCHAR(300),
    "marked_by_id" INTEGER,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_id" INTEGER,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_exam_attendance_per_slot" ON "exam_attendances"("exam_routine_id", "exam_candidate_id");
CREATE INDEX "idx_exam_attendance_madrasa_routine" ON "exam_attendances"("madrasa_id", "exam_routine_id");
CREATE INDEX "idx_exam_attendance_madrasa_routine_status" ON "exam_attendances"("madrasa_id", "exam_routine_id", "status");
CREATE INDEX "idx_exam_attendance_exam_candidate" ON "exam_attendances"("exam_candidate_id");

ALTER TABLE "exam_attendances" ADD CONSTRAINT "exam_attendances_exam_routine_id_fkey"
  FOREIGN KEY ("exam_routine_id") REFERENCES "exam_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_attendances" ADD CONSTRAINT "exam_attendances_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "exam_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
