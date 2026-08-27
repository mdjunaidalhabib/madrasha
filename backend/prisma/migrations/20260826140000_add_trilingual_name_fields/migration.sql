-- Trilingual (Bangla/Arabic/English) name fields for father/mother
-- (students, teachers, staff) and alternate guardian (students only).

ALTER TABLE "students"
  ADD COLUMN "father_name_en" VARCHAR(200),
  ADD COLUMN "mother_arabic_name" VARCHAR(200),
  ADD COLUMN "mother_name_en" VARCHAR(200),
  ADD COLUMN "alt_guardian_arabic_name" VARCHAR(200),
  ADD COLUMN "alt_guardian_name_en" VARCHAR(200);

ALTER TABLE "teachers"
  ADD COLUMN "father_name_en" VARCHAR(200),
  ADD COLUMN "mother_name_ar" VARCHAR(200),
  ADD COLUMN "mother_name_en" VARCHAR(200);

ALTER TABLE "staff"
  ADD COLUMN "father_name_en" VARCHAR(200),
  ADD COLUMN "mother_name_ar" VARCHAR(200),
  ADD COLUMN "mother_name_en" VARCHAR(200);
