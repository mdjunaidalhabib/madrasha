-- Retired public themes fall back to Modern; content and accent colors stay intact.
UPDATE "website_settings"
SET "theme_key" = 'modern'
WHERE "theme_key" IN ('classic', 'minimal') OR "theme_key" IS NULL;

ALTER TABLE "website_settings" ALTER COLUMN "theme_key" SET DEFAULT 'modern';

UPDATE "platform_website_templates"
SET "content" = jsonb_set("content"::jsonb, '{settings,themeKey}', '"modern"'::jsonb)
WHERE "content"::jsonb #>> '{settings,themeKey}' IN ('classic', 'minimal');
