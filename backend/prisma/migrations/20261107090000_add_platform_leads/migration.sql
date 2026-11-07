CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'CONVERTED', 'LOST');
CREATE TABLE "platform_leads" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "institution" VARCHAR(180) NOT NULL,
  "institution_type" VARCHAR(40) NOT NULL,
  "student_count" VARCHAR(30),
  "message" VARCHAR(2000),
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "follow_up_at" TIMESTAMP(3),
  "utm_source" VARCHAR(200), "utm_medium" VARCHAR(200), "utm_campaign" VARCHAR(200),
  "utm_content" VARCHAR(200), "utm_term" VARCHAR(200), "fbclid" VARCHAR(500),
  "landing_path" VARCHAR(300),
  "consent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "platform_leads_status_created_at_idx" ON "platform_leads"("status", "created_at");
CREATE INDEX "platform_leads_phone_created_at_idx" ON "platform_leads"("phone", "created_at");
CREATE INDEX "platform_leads_follow_up_at_idx" ON "platform_leads"("follow_up_at");
