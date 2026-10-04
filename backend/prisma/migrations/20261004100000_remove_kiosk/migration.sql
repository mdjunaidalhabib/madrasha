-- The RFID/fingerprint gate kiosk feature was removed entirely (admin device
-- management, the public /kiosk scan page and its backend module). The K40
-- attendance-device module is separate and keeps students.fingerprint_id.

-- DropForeignKey
ALTER TABLE "kiosk_devices" DROP CONSTRAINT "kiosk_devices_madrasa_id_fkey";

-- DropTable
DROP TABLE "kiosk_devices";

-- DropIndex
DROP INDEX "students_card_uid_key";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "card_uid";

-- Seeded rows: the "kiosk.manage" permission (role_permissions cascade) and
-- the "কিওস্ক ডিভাইস" sidebar feature.
DELETE FROM "permissions" WHERE "key_name" = 'kiosk.manage';
DELETE FROM "module_features" WHERE "key_name" = 'kiosk_devices';
