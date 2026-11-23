CREATE TABLE "question_papers" (
  "id" UUID NOT NULL,
  "madrasa_id" INTEGER NOT NULL,
  "created_by" INTEGER,
  "title" VARCHAR(200) NOT NULL,
  "division_id" INTEGER NOT NULL,
  "class_id" INTEGER NOT NULL,
  "subject_id" INTEGER NOT NULL,
  "division_name" VARCHAR(150) NOT NULL,
  "class_name" VARCHAR(150) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "duration" VARCHAR(100) NOT NULL DEFAULT '',
  "instructions" TEXT NOT NULL DEFAULT '',
  "questions" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_papers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_papers_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_question_papers_tenant_updated" ON "question_papers"("madrasa_id", "updated_at");
