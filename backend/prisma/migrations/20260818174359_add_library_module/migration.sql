-- CreateEnum
CREATE TYPE "LibraryBorrowStatus" AS ENUM ('BORROWED', 'RETURNED', 'LOST');

-- CreateTable
CREATE TABLE "library_book_categories" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_book_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_books" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "title" VARCHAR(250) NOT NULL,
    "author" VARCHAR(200),
    "isbn" VARCHAR(30),
    "publisher" VARCHAR(200),
    "shelf_location" VARCHAR(100),
    "copies_total" INTEGER NOT NULL DEFAULT 1,
    "copies_available" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_borrow_records" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "student_id" INTEGER,
    "teacher_id" INTEGER,
    "borrowed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE NOT NULL,
    "returned_at" TIMESTAMP(3),
    "status" "LibraryBorrowStatus" NOT NULL DEFAULT 'BORROWED',
    "fine_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fine_settled" BOOLEAN NOT NULL DEFAULT false,
    "fine_settled_at" TIMESTAMP(3),
    "issued_by" INTEGER,
    "returned_by" INTEGER,
    "notes" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_borrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_book_categories_madrasa_id_idx" ON "library_book_categories"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_library_category_madrasa_name" ON "library_book_categories"("madrasa_id", "name");

-- CreateIndex
CREATE INDEX "idx_library_book_madrasa_category" ON "library_books"("madrasa_id", "category_id");

-- CreateIndex
CREATE INDEX "idx_library_book_madrasa_title" ON "library_books"("madrasa_id", "title");

-- CreateIndex
CREATE INDEX "idx_library_borrow_madrasa_status" ON "library_borrow_records"("madrasa_id", "status");

-- CreateIndex
CREATE INDEX "idx_library_borrow_madrasa_student" ON "library_borrow_records"("madrasa_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_library_borrow_madrasa_teacher" ON "library_borrow_records"("madrasa_id", "teacher_id");

-- CreateIndex
CREATE INDEX "idx_library_borrow_book" ON "library_borrow_records"("book_id");

-- AddForeignKey
ALTER TABLE "library_book_categories" ADD CONSTRAINT "library_book_categories_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library_book_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_borrow_records" ADD CONSTRAINT "library_borrow_records_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_borrow_records" ADD CONSTRAINT "library_borrow_records_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_borrow_records" ADD CONSTRAINT "library_borrow_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_borrow_records" ADD CONSTRAINT "library_borrow_records_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: exactly one of student_id/teacher_id must be set
-- (Prisma has no OR/XOR column constraint syntax - enforced here by hand,
-- with LibraryService.issueBook() as the primary application-level guard).
ALTER TABLE "library_borrow_records"
  ADD CONSTRAINT "chk_library_borrow_one_borrower"
  CHECK (("student_id" IS NOT NULL AND "teacher_id" IS NULL) OR ("student_id" IS NULL AND "teacher_id" IS NOT NULL));
