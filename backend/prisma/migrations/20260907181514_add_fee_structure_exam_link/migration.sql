-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "exam_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_fee_structure_madrasa_exam" ON "fee_structures"("madrasa_id", "exam_id");

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
