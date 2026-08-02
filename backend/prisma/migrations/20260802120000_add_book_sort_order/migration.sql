-- Let each madrasa arrange its own book order per class (drag-and-drop reorder in the UI).
ALTER TABLE "madrasa_books"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT mb.id,
         ROW_NUMBER() OVER (PARTITION BY mb.madrasa_id, b.class_id ORDER BY b.id) - 1 AS rn
  FROM "madrasa_books" mb
  JOIN "books" b ON b.id = mb.book_id
)
UPDATE "madrasa_books" mb
SET "sort_order" = ranked.rn
FROM ranked
WHERE mb.id = ranked.id;
