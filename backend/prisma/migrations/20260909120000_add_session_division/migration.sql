-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "division_id" INTEGER;

-- DropIndex
DROP INDEX "uniq_session_madrasa_name";

-- DropIndex
DROP INDEX "idx_session_madrasa_current";

-- CreateIndex
CREATE UNIQUE INDEX "uniq_session_madrasa_division_name" ON "sessions"("madrasa_id", "division_id", "name");

-- CreateIndex
CREATE INDEX "idx_session_madrasa_division_current" ON "sessions"("madrasa_id", "division_id", "is_current");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
