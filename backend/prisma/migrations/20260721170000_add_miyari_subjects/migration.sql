-- Mark any number of class subjects as মিয়ারি for each madrasa.
ALTER TABLE "madrasa_books"
ADD COLUMN "is_miyari" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_madrasa_books_miyari"
ON "madrasa_books"("madrasa_id", "is_miyari");
