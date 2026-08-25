-- CreateTable
CREATE TABLE "important_links" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "sub_label" VARCHAR(150),
    "url" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "important_links_pkey" PRIMARY KEY ("id")
);
