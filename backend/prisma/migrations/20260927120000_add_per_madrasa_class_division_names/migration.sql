-- Per-madrasa class/division names. classes/divisions are a shared catalogue,
-- so renaming the catalogue row renamed it in every madrasa. Renames now
-- write these override columns instead; NULL = use the catalogue name.
ALTER TABLE "madrasa_classes" ADD COLUMN IF NOT EXISTS "name_bn" VARCHAR(100);
ALTER TABLE "madrasa_divisions" ADD COLUMN IF NOT EXISTS "name_bn" VARCHAR(100);
