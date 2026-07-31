-- Phase 2: Manual Payment Method Setup (no payment gateway)

CREATE TABLE "payment_method_settings" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "method_type" VARCHAR(20) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "account_name" VARCHAR(150),
    "account_number" VARCHAR(100),
    "bank_name" VARCHAR(150),
    "branch" VARCHAR(150),
    "instructions" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_method_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_payment_method_madrasa_active" ON "payment_method_settings"("madrasa_id", "is_active");

ALTER TABLE "payment_method_settings" ADD CONSTRAINT "payment_method_settings_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD COLUMN "method_setting_id" INTEGER,
  ADD COLUMN "method_label" VARCHAR(150);

ALTER TABLE "payments" ADD CONSTRAINT "payments_method_setting_id_fkey"
  FOREIGN KEY ("method_setting_id") REFERENCES "payment_method_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
