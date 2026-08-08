-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_CARD', 'ADMIT_CARD', 'CERTIFICATE', 'CLEARANCE_CERTIFICATE', 'TESTIMONIAL', 'MARKSHEET', 'FEE_RECEIPT', 'SALARY_SLIP');

-- CreateEnum
CREATE TYPE "DocumentTemplateScope" AS ENUM ('SYSTEM', 'TENANT');

-- CreateEnum
CREATE TYPE "DocumentTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" SERIAL NOT NULL,
    "scope" "DocumentTemplateScope" NOT NULL,
    "tenant_id" INTEGER,
    "type" "DocumentType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "cloned_from_id" INTEGER,
    "createdByRole" VARCHAR(20) NOT NULL,
    "created_by_user_id" INTEGER,
    "created_by_super_admin_id" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system_default" BOOLEAN NOT NULL DEFAULT false,
    "current_version_id" INTEGER,
    "published_version_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_versions" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "version_no" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "background" JSONB,
    "layers" JSONB NOT NULL,
    "status" "DocumentTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_document_defaults" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL,
    "template_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_document_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_doc_templates_tenant_type" ON "document_templates"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "idx_doc_templates_scope_type_active" ON "document_templates"("scope", "type", "is_active");

-- CreateIndex
CREATE INDEX "idx_doc_template_versions_status" ON "document_template_versions"("template_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_template_version_no" ON "document_template_versions"("template_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_tenant_doc_default" ON "tenant_document_defaults"("madrasa_id", "type");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_document_defaults" ADD CONSTRAINT "tenant_document_defaults_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_document_defaults" ADD CONSTRAINT "tenant_document_defaults_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
