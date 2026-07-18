-- Student roll and registration numbers are system-managed identifiers.
-- Backfill any legacy NULL values before enforcing database-level guarantees.

WITH class_max AS (
  SELECT madrasa_id, class_id, academic_year, COALESCE(MAX(roll), 0) AS max_roll
  FROM students
  GROUP BY madrasa_id, class_id, academic_year
),
missing_rolls AS (
  SELECT
    s.id,
    cm.max_roll + ROW_NUMBER() OVER (
      PARTITION BY s.madrasa_id, s.class_id, s.academic_year
      ORDER BY s.id ASC
    ) AS generated_roll
  FROM students s
  JOIN class_max cm
    ON cm.madrasa_id = s.madrasa_id
   AND cm.class_id = s.class_id
   AND cm.academic_year = s.academic_year
  WHERE s.roll IS NULL
)
UPDATE students s
SET roll = missing_rolls.generated_roll
FROM missing_rolls
WHERE s.id = missing_rolls.id;

WITH madrasa_max AS (
  SELECT madrasa_id, COALESCE(MAX(registration_no), 0) AS max_registration_no
  FROM students
  GROUP BY madrasa_id
),
missing_registration AS (
  SELECT
    s.id,
    mm.max_registration_no + ROW_NUMBER() OVER (
      PARTITION BY s.madrasa_id
      ORDER BY s.id ASC
    ) AS generated_registration_no
  FROM students s
  JOIN madrasa_max mm ON mm.madrasa_id = s.madrasa_id
  WHERE s.registration_no IS NULL
)
UPDATE students s
SET registration_no = missing_registration.generated_registration_no
FROM missing_registration
WHERE s.id = missing_registration.id;

ALTER TABLE students ALTER COLUMN roll SET NOT NULL;
ALTER TABLE students ALTER COLUMN registration_no SET NOT NULL;
