-- মেধাস্থান (tie-aware merit position) alongside the existing মেধাক্রম.
-- rank_no stays unique/sequential (1,2,3,4); place_no lets equal scores share
-- one place (1,2,2,4).
ALTER TABLE "results_summary" ADD COLUMN IF NOT EXISTS "place_no" INTEGER;

-- Backfill already-processed results with the same ordering the grading
-- engine uses (GPA desc, then total desc). Fully-absent students have a NULL
-- rank_no and are left NULL here too.
UPDATE "results_summary" rs
SET "place_no" = ranked.place
FROM (
  SELECT
    id,
    RANK() OVER (
      PARTITION BY result_master_id
      ORDER BY COALESCE(gpa, 0) DESC, total DESC
    )::int AS place
  FROM "results_summary"
  WHERE rank_no IS NOT NULL
) ranked
WHERE rs.id = ranked.id
  AND rs.place_no IS NULL;
