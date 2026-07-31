-- Phase 2: Student Fee Management

CREATE TYPE "FeeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'YEARLY');
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

CREATE TABLE "fee_structures" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "class_id" INTEGER,
    "name" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "academic_year" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_fee_structure_madrasa_class_year" ON "fee_structures"("madrasa_id", "class_id", "academic_year");

ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "fee_structure_id" INTEGER,
    "title" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "month" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_invoice_student_fee_month" ON "invoices"("student_id", "fee_structure_id", "month");
CREATE INDEX "idx_invoice_madrasa_student" ON "invoices"("madrasa_id", "student_id");
CREATE INDEX "idx_invoice_madrasa_status" ON "invoices"("madrasa_id", "status");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fee_structure_id_fkey"
  FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" INTEGER,
    "transaction_ref" VARCHAR(120),
    "account_entry_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_payment_madrasa_invoice" ON "payments"("madrasa_id", "invoice_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
