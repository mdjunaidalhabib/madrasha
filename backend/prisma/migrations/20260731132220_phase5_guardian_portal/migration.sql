-- CreateTable
CREATE TABLE "guardians" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200),
    "password_hash" VARCHAR(255) NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_students" (
    "id" SERIAL NOT NULL,
    "guardian_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_guardians_madrasa_active" ON "guardians"("madrasa_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_guardian_madrasa_phone" ON "guardians"("madrasa_id", "phone");

-- CreateIndex
CREATE INDEX "idx_guardian_student_student" ON "guardian_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_guardian_student" ON "guardian_students"("guardian_id", "student_id");

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
