-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "session_id" INTEGER;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "session_id" INTEGER;

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_session_histories" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "from_session_id" INTEGER,
    "to_session_id" INTEGER NOT NULL,
    "from_roll" INTEGER,
    "to_roll" INTEGER NOT NULL,
    "reason" VARCHAR(300),
    "transferred_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_session_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_session_madrasa_current" ON "sessions"("madrasa_id", "is_current");

-- CreateIndex
CREATE INDEX "idx_session_madrasa_active" ON "sessions"("madrasa_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_session_madrasa_name" ON "sessions"("madrasa_id", "name");

-- CreateIndex
CREATE INDEX "idx_session_history_student" ON "student_session_histories"("student_id");

-- CreateIndex
CREATE INDEX "idx_session_history_madrasa" ON "student_session_histories"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_fee_structure_madrasa_class_session" ON "fee_structures"("madrasa_id", "class_id", "session_id");

-- CreateIndex
CREATE INDEX "idx_students_madrasa_session" ON "students"("madrasa_id", "session_id");

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_session_histories" ADD CONSTRAINT "student_session_histories_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_session_histories" ADD CONSTRAINT "student_session_histories_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_session_histories" ADD CONSTRAINT "student_session_histories_from_session_id_fkey" FOREIGN KEY ("from_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_session_histories" ADD CONSTRAINT "student_session_histories_to_session_id_fkey" FOREIGN KEY ("to_session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
