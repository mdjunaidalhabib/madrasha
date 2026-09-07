-- CreateTable
CREATE TABLE "student_fee_discounts" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "fee_structure_id" INTEGER NOT NULL,
    "waived_amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "set_by_id" INTEGER,
    "set_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_fee_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_student_fee_discount_madrasa" ON "student_fee_discounts"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_student_fee_discount" ON "student_fee_discounts"("student_id", "fee_structure_id");

-- AddForeignKey
ALTER TABLE "student_fee_discounts" ADD CONSTRAINT "student_fee_discounts_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_discounts" ADD CONSTRAINT "student_fee_discounts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_discounts" ADD CONSTRAINT "student_fee_discounts_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
