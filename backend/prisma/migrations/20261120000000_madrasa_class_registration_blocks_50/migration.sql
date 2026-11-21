-- Reserve 50 registration numbers per class for future madrasa provisioning.
-- Existing tenant class ranges and issued student numbers are preserved.
INSERT INTO "plan_division_reg_blocks"
  ("plan_id", "division_id", "block_size", "created_at", "updated_at")
SELECT p."id", d."id", 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "plans" p
CROSS JOIN "divisions" d
WHERE d."institution_type" = 'MADRASA'
  AND d."owner_madrasa_id" IS NULL
ON CONFLICT ("plan_id", "division_id") DO UPDATE
SET "block_size" = 50, "updated_at" = CURRENT_TIMESTAMP;
