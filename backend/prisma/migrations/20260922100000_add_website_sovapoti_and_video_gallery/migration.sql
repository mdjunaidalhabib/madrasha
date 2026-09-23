-- পাবলিক ওয়েবসাইটে সভাপতির বাণী + ভিডিও গ্যালারি যোগ করা। Additive only: নতুন কলাম +
-- নতুন টেবিল, বিদ্যমান কোনো কলাম/টেবিল বদলায় না।

-- AlterTable
ALTER TABLE "website_settings" ADD COLUMN     "show_sovapoti" INTEGER DEFAULT 1,
ADD COLUMN     "sovapoti_name" VARCHAR(190),
ADD COLUMN     "sovapoti_designation" VARCHAR(190),
ADD COLUMN     "sovapoti_photo" VARCHAR(255),
ADD COLUMN     "sovapoti_message" TEXT,
ADD COLUMN     "show_video_gallery" INTEGER DEFAULT 1;

-- CreateTable
CREATE TABLE "website_videos" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(190),
    "video_url" VARCHAR(255) NOT NULL,
    "is_published" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_website_videos_madrasa" ON "website_videos"("madrasa_id", "is_published", "sort_order");

-- AddForeignKey
ALTER TABLE "website_videos" ADD CONSTRAINT "website_videos_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
