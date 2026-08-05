-- Let each madrasa arrange its own division order (drag-and-drop reorder in
-- the UI), same idea as madrasa_classes.sort_order / madrasa_books.sort_order.
ALTER TABLE "madrasa_divisions"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT md.id,
         ROW_NUMBER() OVER (PARTITION BY md.madrasa_id ORDER BY md.division_id) - 1 AS rn
  FROM "madrasa_divisions" md
)
UPDATE "madrasa_divisions" md
SET "sort_order" = ranked.rn
FROM ranked
WHERE md.id = ranked.id;
