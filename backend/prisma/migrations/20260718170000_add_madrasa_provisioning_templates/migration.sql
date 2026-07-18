-- Platform-level provisioning templates. These rows are populated by
-- prisma/seed.ts and copied into a madrasa only when Super Admin creates it.

CREATE TABLE "default_exams" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(80) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "default_general_grades" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(80) NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "min_mark" INTEGER NOT NULL,
    "max_mark" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_general_grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "default_madrasa_grades" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(80) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "min_mark" INTEGER NOT NULL,
    "max_mark" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_madrasa_grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "default_settings" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "default_exams_key_name_key" ON "default_exams"("key_name");
CREATE UNIQUE INDEX "default_general_grades_key_name_key" ON "default_general_grades"("key_name");
CREATE UNIQUE INDEX "default_madrasa_grades_key_name_key" ON "default_madrasa_grades"("key_name");
CREATE UNIQUE INDEX "default_settings_name_key" ON "default_settings"("name");
