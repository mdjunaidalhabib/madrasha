-- CreateEnum
CREATE TYPE "ExamCandidateStatus" AS ENUM ('REGISTERED', 'ELIGIBLE', 'INELIGIBLE', 'WITHHELD', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PLANNED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'SCHEDULED', 'ONGOING', 'MARKS_ENTRY', 'VERIFICATION', 'RESULT_PROCESSING', 'RESULT_APPROVAL', 'PUBLISHED', 'LOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarkEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarkComponentType" AS ENUM ('WRITTEN', 'MCQ', 'PRACTICAL', 'ORAL', 'ASSIGNMENT', 'CLASS_ASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResultPublishStatus" ADD VALUE 'MARKS_SUBMITTED';
ALTER TYPE "ResultPublishStatus" ADD VALUE 'MARKS_VERIFIED';
ALTER TYPE "ResultPublishStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "ResultPublishStatus" ADD VALUE 'RESULT_VERIFIED';
ALTER TYPE "ResultPublishStatus" ADD VALUE 'APPROVED';
ALTER TYPE "ResultPublishStatus" ADD VALUE 'LOCKED';

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "exam_type" VARCHAR(50),
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "results_master" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" INTEGER,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "locked_by" INTEGER,
ADD COLUMN     "marks_verified_at" TIMESTAMP(3),
ADD COLUMN     "marks_verified_by" INTEGER,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processed_by" INTEGER,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "published_by" INTEGER,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" INTEGER,
ADD COLUMN     "rejected_reason" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "result_verified_at" TIMESTAMP(3),
ADD COLUMN     "result_verified_by" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "submitted_by" INTEGER;

-- CreateTable
CREATE TABLE "exam_candidates" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "registration_no" VARCHAR(50),
    "candidate_no" VARCHAR(50),
    "status" "ExamCandidateStatus" NOT NULL DEFAULT 'REGISTERED',
    "eligibility_status" "EligibilityStatus" NOT NULL DEFAULT 'PENDING',
    "eligibility_reasons" TEXT,
    "eligibility_checked_at" TIMESTAMP(3),
    "registration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(500),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_submissions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "result_master_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "status" "MarkEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by" INTEGER,
    "submitted_at" TIMESTAMP(3),
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_component_configs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "exam_id" INTEGER,
    "component" "MarkComponentType" NOT NULL,
    "full_mark" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_component_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_component_values" (
    "id" SERIAL NOT NULL,
    "mark_id" INTEGER NOT NULL,
    "component" "MarkComponentType" NOT NULL,
    "value" DOUBLE PRECISION,

    CONSTRAINT "mark_component_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_corrections" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "result_master_id" INTEGER NOT NULL,
    "student_id" INTEGER,
    "book_id" INTEGER,
    "field" VARCHAR(50) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "result_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_snapshots" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "result_master_id" INTEGER NOT NULL,
    "snapshot_json" TEXT NOT NULL,
    "reason" VARCHAR(30) NOT NULL DEFAULT 'PUBLISH',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_exam_candidate_madrasa_exam" ON "exam_candidates"("madrasa_id", "exam_id");

-- CreateIndex
CREATE INDEX "idx_exam_candidate_madrasa_exam_class" ON "exam_candidates"("madrasa_id", "exam_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_exam_candidate_madrasa_exam_status" ON "exam_candidates"("madrasa_id", "exam_id", "status");

-- CreateIndex
CREATE INDEX "idx_exam_candidate_madrasa_exam_eligibility" ON "exam_candidates"("madrasa_id", "exam_id", "eligibility_status");

-- CreateIndex
CREATE INDEX "idx_exam_candidate_student" ON "exam_candidates"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_exam_candidate_exam_student" ON "exam_candidates"("exam_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_exam_candidate_registration_no" ON "exam_candidates"("madrasa_id", "exam_id", "registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_exam_candidate_candidate_no" ON "exam_candidates"("madrasa_id", "exam_id", "candidate_no");

-- CreateIndex
CREATE INDEX "idx_mark_submissions_madrasa" ON "mark_submissions"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_mark_submissions_result_master" ON "mark_submissions"("result_master_id");

-- CreateIndex
CREATE INDEX "idx_mark_submissions_status" ON "mark_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_mark_submission" ON "mark_submissions"("result_master_id", "book_id");

-- CreateIndex
CREATE INDEX "idx_mark_component_configs_madrasa_book" ON "mark_component_configs"("madrasa_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_mark_component_config" ON "mark_component_configs"("madrasa_id", "book_id", "exam_id", "component");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_mark_component_value" ON "mark_component_values"("mark_id", "component");

-- CreateIndex
CREATE INDEX "idx_result_corrections_madrasa" ON "result_corrections"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_result_corrections_result_master" ON "result_corrections"("result_master_id");

-- CreateIndex
CREATE INDEX "idx_result_corrections_status" ON "result_corrections"("status");

-- CreateIndex
CREATE INDEX "idx_result_snapshots_result_master" ON "result_snapshots"("result_master_id");

-- CreateIndex
CREATE INDEX "idx_exam_madrasa_status" ON "exams"("madrasa_id", "status");

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_candidates" ADD CONSTRAINT "exam_candidates_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_submissions" ADD CONSTRAINT "mark_submissions_result_master_id_fkey" FOREIGN KEY ("result_master_id") REFERENCES "results_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_submissions" ADD CONSTRAINT "mark_submissions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_component_configs" ADD CONSTRAINT "mark_component_configs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_component_values" ADD CONSTRAINT "mark_component_values_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_corrections" ADD CONSTRAINT "result_corrections_result_master_id_fkey" FOREIGN KEY ("result_master_id") REFERENCES "results_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_result_master_id_fkey" FOREIGN KEY ("result_master_id") REFERENCES "results_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;
