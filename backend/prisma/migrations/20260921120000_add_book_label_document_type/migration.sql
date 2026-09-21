-- পুরস্কার বই-লেবেলকে Document Designer-এর নতুন টাইপ হিসেবে যোগ করা (প্রবেশপত্রের মতো একাধিক
-- ডিজাইন + নিজের টেমপ্লেট)। Additive only: enum-এ একটি নতুন মান, কোনো টেবিল/কলাম বদলায় না।
-- ADD VALUE একই ট্রানজ্যাকশনে ব্যবহার করা যায় না - এই মাইগ্রেশনে ব্যবহারও নেই।

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'BOOK_LABEL';
