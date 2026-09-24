-- প্রতিটি শ্রেণির জন্য আলাদা রেজিস্ট্রেশন নম্বরের ব্লক (যেমন এক শ্রেণি ১-৫০,
-- আরেক শ্রেণি ৫১-১০০)। নম্বর পুরো মাদ্রাসায় ইউনিকই থাকে (uniq_registration_no
-- অপরিবর্তিত) - শুধু নতুন নম্বর কোন রেঞ্জ থেকে আসবে সেটা ঠিক হয় শ্রেণি থেকে।
-- বিদ্যমান ছাত্রদের নম্বর বদলানো হয় না। ব্লক সেট না থাকলে আগের মতো
-- মাদ্রাসার সর্বশেষ নম্বরের পরেরটা দেওয়া হয়।
ALTER TABLE "madrasa_classes" ADD COLUMN "reg_no_start" INTEGER;
ALTER TABLE "madrasa_classes" ADD COLUMN "reg_no_end" INTEGER;
-- এই ব্লক থেকে সর্বশেষ দেওয়া নম্বর - প্রমোশনে কেউ ব্লক ছেড়ে গেলেও তার
-- নম্বর আর কাউকে দেওয়া হবে না।
ALTER TABLE "madrasa_classes" ADD COLUMN "reg_no_last_issued" INTEGER;

-- প্ল্যান অনুযায়ী প্রতিটি বিভাগের প্রতি শ্রেণির ব্লকের সাইজ (যেমন Basic:
-- নূরানী ৩০, নাযেরা/হিফজ ৪০, কিতাব ২০, তাখাসসুস ১০)। নতুন মাদ্রাসা তৈরি, প্ল্যান বদল
-- বা নতুন শ্রেণি যোগের সময় যেসব শ্রেণির ব্লক নেই, সেগুলোতে এই সাইজে পরপর
-- ব্লক বসানো হয়। অ্যাডমিন পরে যেকোনো ব্লক বদলাতে পারেন।
CREATE TABLE "plan_division_reg_blocks" (
    "plan_id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "block_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_division_reg_blocks_pkey" PRIMARY KEY ("plan_id","division_id")
);

ALTER TABLE "plan_division_reg_blocks" ADD CONSTRAINT "plan_division_reg_blocks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_division_reg_blocks" ADD CONSTRAINT "plan_division_reg_blocks_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ডিফল্ট সাইজ (seed.ts-এর সাথে মিল রেখে)। সুপার অ্যাডমিন প্ল্যান পেজ থেকে বদলাতে পারবেন।
INSERT INTO "plan_division_reg_blocks" ("plan_id", "division_id", "block_size")
SELECT p.id, d.id, v.block_size
FROM (VALUES
  ('Basic', 'nurani', 30), ('Basic', 'nazera_hifz', 40), ('Basic', 'kitab', 20),
  ('Standard', 'nurani', 60), ('Standard', 'nazera_hifz', 80), ('Standard', 'kitab', 40),
  ('Premium', 'nurani', 150), ('Premium', 'nazera_hifz', 200), ('Premium', 'kitab', 100),
  ('Basic', 'takhassus', 10), ('Standard', 'takhassus', 20), ('Premium', 'takhassus', 50)
) AS v(plan_name, division_key, block_size)
JOIN "plans" p ON p.name = v.plan_name
JOIN "divisions" d ON d.key_name = v.division_key
ON CONFLICT DO NOTHING;
