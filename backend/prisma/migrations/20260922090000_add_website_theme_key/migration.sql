-- Per-madrasa public-website theme selector ("classic" | "modern" | "minimal").
-- Additive only: one new nullable column with a default. Safe to deploy
-- before the code.

-- AlterTable
ALTER TABLE "website_settings" ADD COLUMN     "theme_key" VARCHAR(30) DEFAULT 'classic';
