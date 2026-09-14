-- CreateTable
CREATE TABLE "printable_notices" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "printable_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_printable_notices_madrasa" ON "printable_notices"("madrasa_id", "updated_at");

-- AddForeignKey
ALTER TABLE "printable_notices" ADD CONSTRAINT "printable_notices_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
