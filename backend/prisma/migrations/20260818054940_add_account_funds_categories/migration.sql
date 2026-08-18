-- CreateTable
CREATE TABLE "account_funds" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "type" "AccountType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_categories" (
    "id" SERIAL NOT NULL,
    "fund_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_account_funds_madrasa_type" ON "account_funds"("madrasa_id", "type");

-- CreateIndex
CREATE INDEX "idx_account_categories_fund" ON "account_categories"("fund_id");

-- AddForeignKey
ALTER TABLE "account_funds" ADD CONSTRAINT "account_funds_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "account_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
