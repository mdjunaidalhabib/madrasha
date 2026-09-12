-- Read-only safety check for 20260911140000_result_tenant_fk_and_correction_index.
-- Every count below must be 0 before applying migration.sql.

-- 1. Orphan madrasa_id on the four tables getting new FK constraints
SELECT count(*)::int AS n FROM mark_submissions t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);

SELECT count(*)::int AS n FROM mark_component_configs t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);

SELECT count(*)::int AS n FROM result_corrections t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);

SELECT count(*)::int AS n FROM result_snapshots t
WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id);

-- 2. Existing duplicate PENDING summary-level corrections (book_id IS NULL)
-- that would violate the fixed COALESCE(book_id, -1) unique index
SELECT count(*)::int AS n FROM (
  SELECT result_master_id, student_id, field, count(*) c
  FROM result_corrections
  WHERE status = 'PENDING' AND book_id IS NULL
  GROUP BY result_master_id, student_id, field
  HAVING count(*) > 1
) x;
