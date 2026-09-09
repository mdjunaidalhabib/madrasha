-- Merge Session.isCurrent into Session.isActive: a session's "active"
-- flag now IS its "current/default session for this division" flag.
-- Preserve the old isCurrent value into isActive before dropping the column.
UPDATE "sessions" SET "is_active" = "is_current";

DROP INDEX "idx_session_madrasa_division_current";
DROP INDEX "idx_session_madrasa_active";

ALTER TABLE "sessions" DROP COLUMN "is_current";
ALTER TABLE "sessions" ALTER COLUMN "is_active" SET DEFAULT false;

CREATE INDEX "idx_session_madrasa_division_current" ON "sessions"("madrasa_id", "division_id", "is_active");
