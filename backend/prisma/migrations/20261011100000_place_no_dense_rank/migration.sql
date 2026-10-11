-- মেধাস্থান now uses dense ranking: equal scores share one place and the next
-- lower score takes the very next number (1,1,2,3 - no skipped places).
-- Re-backfill every already-processed result with the same ordering the
-- grading engine uses (GPA desc, then total desc). Fully-absent students have
-- a NULL rank_no and stay NULL.
UPDATE "results_summary" rs
SET "place_no" = ranked.place
FROM (
  SELECT
    id,
    DENSE_RANK() OVER (
      PARTITION BY result_master_id
      ORDER BY COALESCE(gpa, 0) DESC, total DESC
    )::int AS place
  FROM "results_summary"
  WHERE rank_no IS NOT NULL
) ranked
WHERE rs.id = ranked.id;
