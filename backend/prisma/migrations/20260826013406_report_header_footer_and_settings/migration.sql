-- AlterTable
ALTER TABLE "madrasas" ADD COLUMN     "report_footer_text" TEXT,
ADD COLUMN     "report_header_footer_enabled" INTEGER DEFAULT 0,
ADD COLUMN     "report_header_text" TEXT,
ADD COLUMN     "report_print_mode" VARCHAR(20) DEFAULT 'normal',
ADD COLUMN     "settings_section_toggles" JSONB;

-- AlterTable
ALTER TABLE "website_settings" ADD COLUMN     "notice_bar_speed" INTEGER DEFAULT 20;
