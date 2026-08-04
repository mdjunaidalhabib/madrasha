-- Per-subject full mark (out of how many the subject is examined), tenant-
-- specific like is_miyari. Defaults to 100 so every existing subject keeps
-- behaving exactly as before.
ALTER TABLE "madrasa_books"
ADD COLUMN "full_mark" INTEGER NOT NULL DEFAULT 100;

-- Data fix: in the নাযেরা/হিফজ division, only the class's own primary
-- subject (Nazera in the Nazera class, Hifz in the Hifz class) is a 100-mark
-- exam. Every other subject in that division (Tajweed, Masael, ...) is a
-- 50-mark exam. This applies to every madrasa's madrasa_books rows, not
-- just one tenant.
UPDATE "madrasa_books" mb
SET "full_mark" = 50
FROM "books" b
JOIN "classes" c ON c.id = b.class_id
JOIN "divisions" d ON d.id = c.division_id
WHERE mb.book_id = b.id
  AND d.key_name = 'nazera_hifz'
  AND b.name IS DISTINCT FROM c.name;
