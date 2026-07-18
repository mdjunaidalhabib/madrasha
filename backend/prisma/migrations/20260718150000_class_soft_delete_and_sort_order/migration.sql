-- Classes should never be hard-deleted once a madrasha or student is
-- already using them (that breaks the class "id" and silently drops
-- madrasa_classes assignments on re-seed). Instead we soft-deactivate.

ALTER TABLE "classes" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "classes" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill sort_order for existing rows so the current display order
-- (division, then id) is preserved until the next seed run assigns the
-- real intended order.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY division_id ASC NULLS LAST, id ASC) AS rn
  FROM "classes"
)
UPDATE "classes" c
SET "sort_order" = ordered.rn
FROM ordered
WHERE c.id = ordered.id;
