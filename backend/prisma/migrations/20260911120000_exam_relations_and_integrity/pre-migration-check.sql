-- Pre-migration safety check for 20260911120000_exam_relations_and_integrity.
--
-- Run this FIRST, against the target database, before applying migration.sql.
-- Every query here is COUNT-only or ID-only (never selects student names,
-- phone numbers, or other PII) so the output is safe to paste into a ticket
-- or share with a DBA without leaking production data.
--
-- How to run (from backend/):
--   psql "$DATABASE_URL" -f prisma/migrations/20260911120000_exam_relations_and_integrity/pre-migration-check.sql
-- or, without a local psql client:
--   npx prisma db execute --schema=prisma/schema.prisma --file=prisma/migrations/20260911120000_exam_relations_and_integrity/pre-migration-check.sql
--
-- Expected result on a healthy database: every count below is 0. If any
-- count is > 0, migration.sql WILL FAIL at that specific ALTER TABLE/CREATE
-- INDEX statement - do not apply the migration until you've investigated
-- and fixed the flagged rows (see the remediation note under each block).
-- NEVER silently delete the flagged rows - they represent real business
-- data (seat allocations, attendance marks, etc.) that a human needs to
-- reconcile.

\echo '--- 1. exam_rooms with a madrasa_id that does not exist ---'
SELECT count(*) AS orphan_exam_rooms
FROM exam_rooms er
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = er.madrasa_id);
-- Remediation if > 0: these rows point at a deleted/never-existing madrasa.
-- Either the madrasa_id was corrupted at insert time, or a madrasa row was
-- hard-deleted without cascading. Identify with:
--   SELECT id, madrasa_id FROM exam_rooms er WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = er.madrasa_id);
-- then either fix madrasa_id to the correct tenant or, if genuinely
-- orphaned/abandoned test data, delete only those specific rows by id after
-- manual review (never a bulk DELETE).

\echo '--- 2. exam_invigilator_assignments with a madrasa_id that does not exist ---'
SELECT count(*) AS orphan_invigilator_assignments
FROM exam_invigilator_assignments t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);
-- Remediation: same approach as #1, scoped to this table. Identify with:
--   SELECT id, madrasa_id FROM exam_invigilator_assignments t WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);

\echo '--- 3. exam_seat_allocations with a bad madrasa_id or exam_candidate_id ---'
SELECT count(*) AS orphan_seat_allocations
FROM exam_seat_allocations t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id)
   OR NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id);
-- Remediation: identify which condition is failing with:
--   SELECT id, madrasa_id FROM exam_seat_allocations t WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);
--   SELECT id, exam_candidate_id FROM exam_seat_allocations t WHERE NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id);
-- A dangling exam_candidate_id most likely means a candidate registration
-- was hard-deleted while its seat allocation survived - review and either
-- restore/relink the candidate or remove that specific seat row after
-- confirming with the madrasa office.

\echo '--- 4. exam_attendances with a bad madrasa_id or exam_candidate_id ---'
SELECT count(*) AS orphan_exam_attendances
FROM exam_attendances t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id)
   OR NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id);
-- Remediation: same pattern as #3, applied to exam_attendances. Identify with:
--   SELECT id, exam_candidate_id FROM exam_attendances t WHERE NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id);

\echo '--- 5. exam_routines with a division_id that does not exist ---'
SELECT count(*) AS invalid_exam_routine_divisions
FROM exam_routines t
WHERE t.division_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM divisions d WHERE d.id = t.division_id);
-- Remediation: this FK is ON DELETE SET NULL, so it's the least risky of
-- the bunch, but the CREATE CONSTRAINT itself still fails if any existing
-- row already violates it. Identify with:
--   SELECT id, division_id FROM exam_routines t WHERE division_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM divisions d WHERE d.id = t.division_id);
-- then either correct division_id or set it to NULL manually before migrating.

\echo '--- 6. mark_component_configs with an exam_id that does not exist ---'
SELECT count(*) AS invalid_mark_component_exam_ids
FROM mark_component_configs t
WHERE t.exam_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = t.exam_id);
-- Remediation: identify with:
--   SELECT id, exam_id FROM mark_component_configs t WHERE exam_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = t.exam_id);
-- then correct exam_id or null it out (it's an optional exam-specific
-- override; nulling reverts that row to a book-wide default).

\echo '--- 7. exams / marks rows missing madrasa_id (would break DROP DEFAULT) ---'
SELECT
  (SELECT count(*) FROM exams WHERE madrasa_id IS NULL) AS exams_missing_madrasa_id,
  (SELECT count(*) FROM marks WHERE madrasa_id IS NULL) AS marks_missing_madrasa_id;
-- Remediation: DROP DEFAULT alone does not require existing NULLs to be
-- fixed (it only stops NEW rows from silently defaulting to 1) - but a
-- non-zero count here means those specific rows are ALREADY cross-tenant-
-- ambiguous today, independent of this migration, and should be
-- investigated and backfilled with the correct madrasa_id as its own fix.

\echo '--- 8. Duplicate PENDING result_corrections (would break the new partial unique index) ---'
SELECT count(*) AS duplicate_pending_correction_groups
FROM (
  SELECT result_master_id, student_id, book_id, field, count(*) AS c
  FROM result_corrections
  WHERE status = 'PENDING'
  GROUP BY result_master_id, student_id, book_id, field
  HAVING count(*) > 1
) dupes;
-- Remediation if > 0: CREATE UNIQUE INDEX uniq_pending_result_correction
-- will fail outright. Identify the group ids with:
--   SELECT result_master_id, student_id, book_id, field, count(*)
--   FROM result_corrections WHERE status = 'PENDING'
--   GROUP BY result_master_id, student_id, book_id, field HAVING count(*) > 1;
-- Then, for each duplicate group, a human (not an automated script) must
-- decide which PENDING request is the real one to keep - typically the
-- most recently requested_at - and move every other duplicate in that
-- group to REJECTED with a decision_note explaining it was a duplicate,
-- e.g.:
--   UPDATE result_corrections SET status = 'REJECTED', decided_at = now(),
--     decision_note = 'Superseded by a duplicate PENDING request - closed during 20260911120000 migration prep'
--   WHERE id = <the specific older duplicate id, never a bulk match>;
-- Never bulk-update by (result_master_id, student_id, book_id, field) alone
-- - always target specific row ids after a human has reviewed which one to
-- keep.

\echo '--- 9. exam_candidates with an exam_id/student_id/madrasa_id that does not exist (sanity check - not touched by this migration, but worth knowing before touching this table's neighbors) ---'
SELECT
  (SELECT count(*) FROM exam_candidates ec WHERE NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = ec.exam_id)) AS candidates_with_bad_exam_id,
  (SELECT count(*) FROM exam_candidates ec WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ec.student_id)) AS candidates_with_bad_student_id;
-- These FKs already exist in the schema (ExamCandidate.exam/student
-- relations) and should already be enforced at the DB level, so a non-zero
-- count here would indicate a pre-existing data integrity problem
-- unrelated to this migration - investigate separately if flagged.

\echo '--- Summary: if every count above is 0, migration.sql is safe to apply as-is. ---'
