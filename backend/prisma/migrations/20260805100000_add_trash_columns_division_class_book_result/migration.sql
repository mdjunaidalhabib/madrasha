-- Extends soft-delete/Trash (already used by students/teachers/exams) to
-- the per-tenant division/class/book join rows and to results_master.
-- Nothing here is hard-deleted directly; a deleted_at timestamp moves the
-- row into Trash, from where it can be restored or permanently deleted.
ALTER TABLE "madrasa_divisions" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "madrasa_classes"   ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "madrasa_books"     ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "results_master"    ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "idx_madrasa_divisions_deleted" ON "madrasa_divisions"("madrasa_id", "deleted_at");
CREATE INDEX "idx_madrasa_classes_deleted"   ON "madrasa_classes"("madrasa_id", "deleted_at");
CREATE INDEX "idx_madrasa_books_deleted"     ON "madrasa_books"("madrasa_id", "deleted_at");
CREATE INDEX "idx_results_master_deleted"    ON "results_master"("madrasa_id", "deleted_at");

-- A trashed result session must not block creating a new one for the same
-- exam+class, so the old full unique index is replaced by a partial unique
-- index that only applies to live (non-trashed) sessions.
DROP INDEX "uniq_session";
CREATE UNIQUE INDEX "uniq_session" ON "results_master"("madrasa_id", "exam_id", "class_id") WHERE "deleted_at" IS NULL;
