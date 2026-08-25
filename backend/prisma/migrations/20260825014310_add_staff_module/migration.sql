-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "registration_no" INTEGER NOT NULL,
    "name_bn" VARCHAR(200) NOT NULL,
    "name_ar" VARCHAR(200),
    "nid" VARCHAR(50),
    "gender" INTEGER,
    "dob" DATE,
    "age" INTEGER,
    "phone" VARCHAR(50),
    "email" VARCHAR(150),
    "designation" VARCHAR(150),
    "department" VARCHAR(150),
    "qualification" VARCHAR(200),
    "experience_year" INTEGER DEFAULT 0,
    "experience_month" INTEGER DEFAULT 0,
    "joining_date" DATE,
    "salary" DECIMAL(10,2),
    "father_name" VARCHAR(200),
    "father_name_ar" VARCHAR(200),
    "father_nid" VARCHAR(50),
    "father_occupation" VARCHAR(150),
    "mother_name" VARCHAR(200),
    "mother_nid" VARCHAR(50),
    "mother_occupation" VARCHAR(150),
    "parent_phone" VARCHAR(50),
    "division" VARCHAR(100),
    "district" VARCHAR(100),
    "thana" VARCHAR(100),
    "village" VARCHAR(150),
    "image" TEXT,
    "is_active" INTEGER DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_staff_madrasa" ON "staff"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_staff_phone" ON "staff"("phone");

-- CreateIndex
CREATE INDEX "idx_staff_madrasa_active" ON "staff"("madrasa_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_staff_email" ON "staff"("madrasa_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_staff_registration_no" ON "staff"("madrasa_id", "registration_no");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
