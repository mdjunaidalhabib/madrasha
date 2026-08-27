-- Student's own name in English, to match the existing name_bn/arabic_name pair.

ALTER TABLE "students"
  ADD COLUMN "name_en" VARCHAR(200);
