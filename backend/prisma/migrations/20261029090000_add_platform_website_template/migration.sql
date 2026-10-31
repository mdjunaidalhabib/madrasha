CREATE TABLE "platform_website_templates" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_website_templates_pkey" PRIMARY KEY ("id")
);
