-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "ResultPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ResultRowStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('active', 'limited', 'disabled');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('trial', 'active', 'expired', 'suspended');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "divisions" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(50),
    "name" VARCHAR(100),
    "name_bn" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_divisions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" SERIAL NOT NULL,
    "division_id" INTEGER,
    "name" VARCHAR(100),
    "name_bn" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "name" VARCHAR(150),
    "name_bn" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_classes" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_books" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_grades" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "min_mark" INTEGER NOT NULL,
    "max_mark" INTEGER NOT NULL,
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "general_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_grades" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "min_mark" INTEGER NOT NULL,
    "max_mark" INTEGER NOT NULL,
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER,
    "type" "AccountType",
    "amount" DECIMAL(10,2),
    "category" VARCHAR(100),
    "description" VARCHAR(255),
    "receipt_no" VARCHAR(80),
    "voucher_no" VARCHAR(80),
    "fund" VARCHAR(120),
    "donor_name" VARCHAR(200),
    "receiver_name" VARCHAR(200),
    "address" VARCHAR(255),
    "mobile" VARCHAR(30),
    "payment_method" VARCHAR(80),
    "entry_date" DATE,
    "entry_time" TIME,
    "created_by" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "hard_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "year" VARCHAR(20) NOT NULL,
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results_master" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "created_by" INTEGER,
    "status" "ResultPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results_summary" (
    "id" SERIAL NOT NULL,
    "result_master_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "general_grade" VARCHAR(20),
    "madrasa_grade" VARCHAR(50),
    "status" "ResultRowStatus",
    "rank_no" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks" (
    "id" SERIAL NOT NULL,
    "result_master_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "mark" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "academic_year" VARCHAR(10) NOT NULL DEFAULT '2025',
    "previous_class_id" INTEGER,
    "name_bn" VARCHAR(200) NOT NULL,
    "arabic_name" VARCHAR(200),
    "nid" VARCHAR(50),
    "gender" INTEGER,
    "dob" DATE,
    "age" INTEGER,
    "father_name" VARCHAR(200),
    "father_arabic_name" VARCHAR(200),
    "father_nid" VARCHAR(50),
    "father_occupation" VARCHAR(150),
    "mother_name" VARCHAR(200),
    "mother_nid" VARCHAR(50),
    "mother_occupation" VARCHAR(150),
    "guardian_phone" VARCHAR(20),
    "division" VARCHAR(100),
    "district" VARCHAR(100),
    "thana" VARCHAR(100),
    "village" VARCHAR(150),
    "image" TEXT,
    "roll" INTEGER,
    "admission_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admins" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "student_limit" INTEGER NOT NULL,
    "user_limit" INTEGER NOT NULL,
    "duration_days" INTEGER DEFAULT 365,
    "price" DECIMAL(10,2) DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(50),
    "name" VARCHAR(100),
    "name_bn" VARCHAR(100),
    "group_name" VARCHAR(100),
    "sort_order" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_features" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER,
    "key_name" VARCHAR(100),
    "name" VARCHAR(150),
    "name_bn" VARCHAR(150),
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "key_name" VARCHAR(100),
    "name" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
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
    "experience_total_months" INTEGER,
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

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "teacher_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasas" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(120),
    "address" VARCHAR(255),
    "student_limit" INTEGER DEFAULT 100,
    "user_limit" INTEGER DEFAULT 5,
    "website_status" "WebsiteStatus" NOT NULL DEFAULT 'active',
    "custom_domain" VARCHAR(190),
    "plan_status" "PlanStatus" NOT NULL DEFAULT 'active',
    "is_active" INTEGER DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_logo" TEXT,
    "report_banner" TEXT,
    "report_watermark" TEXT,
    "report_watermark_opacity" DECIMAL(3,2) NOT NULL DEFAULT 0.08,
    "sanad_template" TEXT,
    "testimonial_template" TEXT,
    "transfer_letter_template" TEXT,
    "admit_card_rules" TEXT,

    CONSTRAINT "madrasas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_subscriptions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER,
    "subscription_id" INTEGER,
    "amount" DECIMAL(10,2),
    "payment_method" VARCHAR(50),
    "transaction_id" VARCHAR(100),
    "status" "PaymentStatus" DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_modules" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER,
    "key_name" VARCHAR(50),
    "name_bn" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50),
    "madrasa_id" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER,
    "user_id" INTEGER,
    "action" VARCHAR(100),
    "entity" VARCHAR(100),
    "entity_id" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_settings" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "logo_url" VARCHAR(255),
    "hero_title" VARCHAR(190),
    "hero_subtitle" TEXT,
    "theme_color" VARCHAR(30) DEFAULT '#2563eb',
    "show_notices" INTEGER DEFAULT 1,
    "show_gallery" INTEGER DEFAULT 1,
    "show_teachers" INTEGER DEFAULT 1,
    "show_admission" INTEGER DEFAULT 1,
    "show_about" INTEGER DEFAULT 1,
    "show_contact" INTEGER DEFAULT 1,
    "is_published" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_pages" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "page_key" VARCHAR(60) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "content" TEXT,
    "is_published" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_notices" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "content" TEXT,
    "is_published" INTEGER DEFAULT 1,
    "published_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_gallery" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(190),
    "image_url" VARCHAR(255) NOT NULL,
    "is_published" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "divisions_key_name_key" ON "divisions"("key_name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_division" ON "madrasa_divisions"("madrasa_id", "division_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_division_class" ON "classes"("division_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_class_book" ON "books"("class_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_class" ON "madrasa_classes"("madrasa_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_book" ON "madrasa_books"("madrasa_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_general_grade_madrasa" ON "general_grades"("madrasa_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_grade_madrasa" ON "madrasa_grades"("madrasa_id", "name");

-- CreateIndex
CREATE INDEX "idx_accounts_madrasa_type" ON "accounts"("madrasa_id", "type");

-- CreateIndex
CREATE INDEX "idx_accounts_fund" ON "accounts"("fund");

-- CreateIndex
CREATE INDEX "idx_accounts_entry_date" ON "accounts"("entry_date");

-- CreateIndex
CREATE INDEX "idx_accounts_madrasa_deleted" ON "accounts"("madrasa_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_exam_madrasa" ON "exams"("madrasa_id", "name", "year");

-- CreateIndex
CREATE INDEX "idx_results_master_madrasa" ON "results_master"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_results_master_exam_class" ON "results_master"("exam_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_results_master_madrasa_exam_class" ON "results_master"("madrasa_id", "exam_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_results_master_status" ON "results_master"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_session" ON "results_master"("madrasa_id", "exam_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_results_summary_result_master" ON "results_summary"("result_master_id");

-- CreateIndex
CREATE INDEX "idx_results_summary_student" ON "results_summary"("student_id");

-- CreateIndex
CREATE INDEX "idx_results_summary_rank" ON "results_summary"("rank_no");

-- CreateIndex
CREATE INDEX "idx_results_summary_result_rank" ON "results_summary"("result_master_id", "rank_no");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_result" ON "results_summary"("result_master_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_marks_master" ON "marks"("result_master_id");

-- CreateIndex
CREATE INDEX "idx_marks_student" ON "marks"("student_id");

-- CreateIndex
CREATE INDEX "idx_marks_exam" ON "marks"("exam_id");

-- CreateIndex
CREATE INDEX "idx_marks_class" ON "marks"("class_id");

-- CreateIndex
CREATE INDEX "idx_marks_book" ON "marks"("book_id");

-- CreateIndex
CREATE INDEX "idx_marks_madrasa" ON "marks"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_marks_master_student" ON "marks"("result_master_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_marks_master_book" ON "marks"("result_master_id", "book_id");

-- CreateIndex
CREATE INDEX "idx_marks_madrasa_exam_class" ON "marks"("madrasa_id", "exam_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_mark" ON "marks"("result_master_id", "student_id", "class_id", "book_id");

-- CreateIndex
CREATE INDEX "idx_students_madrasa" ON "students"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_students_class" ON "students"("class_id");

-- CreateIndex
CREATE INDEX "idx_students_phone" ON "students"("guardian_phone");

-- CreateIndex
CREATE INDEX "idx_students_gender" ON "students"("gender");

-- CreateIndex
CREATE INDEX "idx_students_madrasa_class" ON "students"("madrasa_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_students_madrasa_active" ON "students"("madrasa_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_students_madrasa_year" ON "students"("madrasa_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "unique_roll_per_madrasa" ON "students"("madrasa_id", "roll");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_plan_name" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "modules_key_name_key" ON "modules"("key_name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_feature" ON "module_features"("module_id", "key_name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_name_key" ON "permissions"("key_name");

-- CreateIndex
CREATE INDEX "idx_teachers_madrasa" ON "teachers"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_teachers_division_id" ON "teachers"("division_id");

-- CreateIndex
CREATE INDEX "idx_teachers_phone" ON "teachers"("phone");

-- CreateIndex
CREATE INDEX "idx_experience_total" ON "teachers"("experience_total_months");

-- CreateIndex
CREATE INDEX "idx_joining_date" ON "teachers"("joining_date");

-- CreateIndex
CREATE INDEX "idx_teachers_madrasa_active" ON "teachers"("madrasa_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_teacher_email" ON "teachers"("madrasa_id", "email");

-- CreateIndex
CREATE INDEX "idx_teacher_assignments_madrasa" ON "teacher_assignments"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_teacher_assignments_teacher" ON "teacher_assignments"("teacher_id");

-- CreateIndex
CREATE INDEX "idx_teacher_assignments_class" ON "teacher_assignments"("class_id");

-- CreateIndex
CREATE INDEX "idx_teacher_assignments_book" ON "teacher_assignments"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_assignment" ON "teacher_assignments"("madrasa_id", "teacher_id", "class_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "madrasas_slug_key" ON "madrasas"("slug");

-- CreateIndex
CREATE INDEX "idx_madrasas_active" ON "madrasas"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_madrasas_plan_status" ON "madrasas"("plan_status");

-- CreateIndex
CREATE INDEX "idx_subscription_madrasa_active" ON "madrasa_subscriptions"("madrasa_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_payments_madrasa" ON "payments"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_payments_subscription" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_module" ON "madrasa_modules"("madrasa_id", "module_id");

-- CreateIndex
CREATE INDEX "idx_roles_madrasa" ON "roles"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_role_madrasa_key" ON "roles"("madrasa_id", "key_name");

-- CreateIndex
CREATE INDEX "idx_users_madrasa" ON "users"("madrasa_id");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "idx_users_madrasa_active" ON "users"("madrasa_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_email_madrasa" ON "users"("madrasa_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_setting_madrasa" ON "settings"("madrasa_id", "name");

-- CreateIndex
CREATE INDEX "idx_activity_madrasa_created" ON "activity_logs"("madrasa_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_activity_user" ON "activity_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_settings_madrasa_id_key" ON "website_settings"("madrasa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_website_page" ON "website_pages"("madrasa_id", "page_key");

-- CreateIndex
CREATE INDEX "idx_website_notices_madrasa" ON "website_notices"("madrasa_id", "is_published", "published_at");

-- CreateIndex
CREATE INDEX "idx_website_gallery_madrasa" ON "website_gallery"("madrasa_id", "is_published", "sort_order");

-- AddForeignKey
ALTER TABLE "madrasa_divisions" ADD CONSTRAINT "madrasa_divisions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_divisions" ADD CONSTRAINT "madrasa_divisions_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_classes" ADD CONSTRAINT "madrasa_classes_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_classes" ADD CONSTRAINT "madrasa_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_books" ADD CONSTRAINT "madrasa_books_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_books" ADD CONSTRAINT "madrasa_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_grades" ADD CONSTRAINT "general_grades_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_grades" ADD CONSTRAINT "madrasa_grades_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results_master" ADD CONSTRAINT "results_master_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results_master" ADD CONSTRAINT "results_master_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results_master" ADD CONSTRAINT "results_master_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results_summary" ADD CONSTRAINT "results_summary_result_master_id_fkey" FOREIGN KEY ("result_master_id") REFERENCES "results_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results_summary" ADD CONSTRAINT "results_summary_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_previous_class_id_fkey" FOREIGN KEY ("previous_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_features" ADD CONSTRAINT "module_features_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_subscriptions" ADD CONSTRAINT "madrasa_subscriptions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_subscriptions" ADD CONSTRAINT "madrasa_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "madrasa_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_modules" ADD CONSTRAINT "madrasa_modules_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_modules" ADD CONSTRAINT "madrasa_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_notices" ADD CONSTRAINT "website_notices_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_gallery" ADD CONSTRAINT "website_gallery_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
