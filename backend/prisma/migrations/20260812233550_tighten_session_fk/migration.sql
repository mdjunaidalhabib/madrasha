-- Session backfill (prisma/backfill-sessions.ts) has been run and verified:
-- every student/fee_structure row now has a session_id, and no duplicate
-- (madrasa_id, class_id, session_id, roll) groups exist. Safe to tighten.

ALTER TABLE "students" ALTER COLUMN "session_id" SET NOT NULL;
ALTER TABLE "fee_structures" ALTER COLUMN "session_id" SET NOT NULL;

DROP INDEX "unique_roll_per_class_year";
ALTER TABLE "students" ADD CONSTRAINT "unique_roll_per_class_session" UNIQUE ("madrasa_id", "class_id", "session_id", "roll");
