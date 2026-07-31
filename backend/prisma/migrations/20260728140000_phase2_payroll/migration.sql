-- Phase 2: Salary & Payroll Management

CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "payroll_records" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "month" VARCHAR(10) NOT NULL,
    "basic_salary" DECIMAL(10,2) NOT NULL,
    "allowances" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "paid_by" INTEGER,
    "account_entry_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_payroll_teacher_month" ON "payroll_records"("teacher_id", "month");
CREATE INDEX "idx_payroll_madrasa_month" ON "payroll_records"("madrasa_id", "month");

ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
