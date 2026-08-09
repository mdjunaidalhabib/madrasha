-- CreateTable
CREATE TABLE "default_fee_structures" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(80) NOT NULL,
    "class_id" INTEGER,
    "name" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "default_fee_structures_key_name_key" ON "default_fee_structures"("key_name");

-- AddForeignKey
ALTER TABLE "default_fee_structures" ADD CONSTRAINT "default_fee_structures_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
