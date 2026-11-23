CREATE TABLE "question_paper_closing_templates" (
  "id" UUID NOT NULL,
  "madrasa_id" INTEGER NOT NULL,
  "text" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_paper_closing_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_paper_closing_templates_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "question_paper_closing_templates_madrasa_id_text_key" ON "question_paper_closing_templates"("madrasa_id", "text");
