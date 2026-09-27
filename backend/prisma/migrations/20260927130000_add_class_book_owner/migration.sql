-- Private classes/books. classes/books are the shared Super Admin catalogue,
-- but a madrasa's own "শ্রেণি/কিতাব যোগ" and copy-on-write kitab renames were
-- created there too with no owner, so creating/editing another madrasa linked
-- (and could activate) them there as well. owner_madrasa_id marks them.
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "owner_madrasa_id" INTEGER;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "owner_madrasa_id" INTEGER;
CREATE INDEX IF NOT EXISTS "idx_classes_owner" ON "classes"("owner_madrasa_id");
CREATE INDEX IF NOT EXISTS "idx_books_owner" ON "books"("owner_madrasa_id");

-- Backfill: tenant-created books are the only ones without an English
-- catalogue key (name IS NULL); the owner is the madrasa linked first.
UPDATE "books" b
SET "owner_madrasa_id" = (
  SELECT mb."madrasa_id" FROM "madrasa_books" mb
  WHERE mb."book_id" = b."id"
  ORDER BY mb."created_at" ASC, mb."id" ASC
  LIMIT 1
)
WHERE b."name" IS NULL AND b."owner_madrasa_id" IS NULL;
