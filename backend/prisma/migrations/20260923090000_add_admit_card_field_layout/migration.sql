-- প্রবেশপত্রের "ডিফল্ট (সাধারণ)" ডিজাইনের তথ্য-ফিল্ড ভিজিবিলিটি + ক্রম সংরক্ষণের জন্য নতুন
-- কলাম (marksheet_field_layout-এর মতোই)। Additive only: বিদ্যমান কোনো কলাম বদলায় না।

-- AlterTable
ALTER TABLE "madrasas" ADD COLUMN     "admit_card_field_layout" JSONB;
