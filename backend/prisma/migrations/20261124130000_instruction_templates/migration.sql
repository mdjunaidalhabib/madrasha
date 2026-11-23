ALTER TABLE "question_paper_closing_templates" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'closing';
DROP INDEX "question_paper_closing_templates_madrasa_id_text_key";
DROP INDEX "question_paper_closing_templates_madrasa_id_builtin_key_key";
CREATE UNIQUE INDEX "question_paper_closing_templates_madrasa_id_kind_text_key"
  ON "question_paper_closing_templates"("madrasa_id", "kind", "text");
CREATE UNIQUE INDEX "question_paper_closing_templates_madrasa_id_kind_builtin_key_key"
  ON "question_paper_closing_templates"("madrasa_id", "kind", "builtin_key");
