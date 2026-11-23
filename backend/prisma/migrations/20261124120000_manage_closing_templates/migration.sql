ALTER TABLE "question_paper_closing_templates"
  ADD COLUMN "builtin_key" VARCHAR(30),
  ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "question_paper_closing_templates_madrasa_id_builtin_key_key"
  ON "question_paper_closing_templates"("madrasa_id", "builtin_key");
