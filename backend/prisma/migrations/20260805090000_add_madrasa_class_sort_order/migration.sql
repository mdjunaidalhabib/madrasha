-- Let each madrasa arrange its own class order per division (drag-and-drop
-- reorder in the UI), same idea as madrasa_books.sort_order — the shared
-- global classes.sort_order stays as a catalog-wide fallback only.
ALTER TABLE "madrasa_classes"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT mc.id,
         ROW_NUMBER() OVER (PARTITION BY mc.madrasa_id, c.division_id ORDER BY c.sort_order, c.id) - 1 AS rn
  FROM "madrasa_classes" mc
  JOIN "classes" c ON c.id = mc.class_id
)
UPDATE "madrasa_classes" mc
SET "sort_order" = ranked.rn
FROM ranked
WHERE mc.id = ranked.id;
