-- বিভাগভিত্তিক পরীক্ষা: একটি পরীক্ষা এক/একাধিক বিভাগের জন্য নির্ধারণ করা যায়।
-- কোনো row না থাকা = "সকল বিভাগ", তাই বিদ্যমান সব পরীক্ষা আগের মতোই চলবে
-- (কোনো backfill লাগবে না)।

-- CreateTable
CREATE TABLE "exam_divisions" (
    "exam_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_divisions_pkey" PRIMARY KEY ("exam_id","division_id")
);

-- CreateIndex
CREATE INDEX "idx_exam_divisions_division" ON "exam_divisions"("division_id");

-- AddForeignKey
ALTER TABLE "exam_divisions" ADD CONSTRAINT "exam_divisions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_divisions" ADD CONSTRAINT "exam_divisions_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- একই নাম+সাল এখন ভিন্ন ভিন্ন বিভাগের জন্য আলাদা পরীক্ষা হিসেবে থাকতে পারে;
-- ওভারল্যাপ চেক ExamService করে। তাই unique index বদলে সাধারণ index।
DROP INDEX IF EXISTS "uniq_exam_madrasa";
CREATE INDEX "idx_exam_madrasa_name_year" ON "exams"("madrasa_id", "name", "year");
