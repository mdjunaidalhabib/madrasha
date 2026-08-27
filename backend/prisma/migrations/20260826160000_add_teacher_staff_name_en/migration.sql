-- Teacher/Staff own name in English, to match the existing name_bn/name_ar pair.

ALTER TABLE "teachers"
  ADD COLUMN "name_en" VARCHAR(200);

ALTER TABLE "staff"
  ADD COLUMN "name_en" VARCHAR(200);
