/** Public website themes; panel dark mode is a separate preference. */
export const WEBSITE_THEMES = [
  { key: "modern", bn: "মডার্ন", en: "Modern", descriptionBn: "গোলাকার কার্ড ও হালকা রঙিন সেকশন", descriptionEn: "Rounded cards and lightly tinted sections" },
  { key: "heritage", bn: "ঐতিহ্য", en: "Heritage", descriptionBn: "ক্রিম ক্যানভাস, খিলান ফ্রেম ও ঐতিহ্যবাহী অলংকরণ", descriptionEn: "Warm ivory, an arched frame and traditional ornaments" },
  { key: "campus", bn: "ক্যাম্পাস", en: "Campus", descriptionBn: "প্রশস্ত রঙিন প্যানেল, ভাসমান হেডার ও প্রাণবন্ত কার্ড", descriptionEn: "Bold panels, a floating header and playful cards" },
  { key: "editorial", bn: "সম্পাদকীয়", en: "Editorial", descriptionBn: "ম্যাগাজিন বিন্যাস, বাঁ পাশে তথ্য ও রেখাযুক্ত শিরোনাম", descriptionEn: "Magazine layout, left information column and ruled headings" },
] as const;

export type WebsiteThemeKey = (typeof WEBSITE_THEMES)[number]["key"];
