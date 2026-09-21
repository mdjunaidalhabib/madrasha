-- ID card back-side settings (issue date, expiry, principal title/signature,
-- "if lost, return to" text) as one JSON blob. Additive only: one new
-- nullable column. Safe to deploy before the code.

-- AlterTable
ALTER TABLE "madrasas" ADD COLUMN     "id_card_back_settings" JSONB;
