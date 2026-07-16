export const DEFAULT_INCOME_FUNDS = [
  {
    name: "সাধারণ ফান্ড",
    categories: ["সাধারণ দান", "ছাত্র বেতন", "ভর্তি ফি", "ভর্তি ফরম", "বোর্ডিং ফি", "পরীক্ষা ফি"],
  },
  { name: "গোরাবা ফান্ড", categories: ["যাকাত", "ফিতরা", "সদকা"] },
  { name: "মসজিদ ফান্ড", categories: ["মসজিদ দান", "জুমা কালেকশন"] },
  { name: "কবরস্থান ফান্ড", categories: ["কবরস্থান দান"] },
  { name: "নির্মাণ ফান্ড", categories: ["নির্মাণ"] },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "শিক্ষক ও স্টাফ বেতন",
  "বোর্ডিং / ইফতার খরচ",
  "কম্পোজ / ছাপা / স্টেশনারী / মনোহরী",
  "নির্মাণ",
  "মেরামত",
  "ইলেকট্রিক ও সরঞ্জামাদি",
  "আসবাবপত্র ক্রয়",
  "সম্মানী / অডিট / বোর্ড ফি",
  "লাইব্রেরী",
  "অনুষ্ঠান / মাহফিল",
  "মোবাইল",
  "যাতায়াত",
  "আপ্যায়ন",
  "বিবিধ",
];

export const DEFAULT_MOSQUE_EXPENSES = [
  "ইমামের সম্মানী",
  "মুয়াজ্জিন সম্মানী",
  "খাদেমের সম্মানী",
  "বিদ্যুৎ বিল",
  "আসবাবপত্র ও অন্যান্য খরচ",
];

export const DEFAULT_GRAVEYARD_EXPENSES = ["পরিষ্কার পরিচ্ছন্নতা", "মাটি ভরাট / রক্ষণাবেক্ষণ", "উন্নয়ন ও অন্যান্য"];

export const PAYMENT_METHODS = ["নগদ টাকা", "ব্যাংক / মোবাইল ব্যাংকিং"];

export const INCOME_VALIDATION_MESSAGE = "নাম, ফান্ড, খাত, পরিমাণ ও পেমেন্ট মাধ্যম বাধ্যতামূলক";
export const EXPENSE_VALIDATION_MESSAGE = "নাম, ফান্ড, ব্যয়ের খাত, পরিমাণ ও পেমেন্ট মাধ্যম বাধ্যতামূলক";
export const INCOME_SUCCESS_MESSAGE = "আয় এন্ট্রি সফল হয়েছে";
export const EXPENSE_SUCCESS_MESSAGE = "ব্যয় এন্ট্রি সফল হয়েছে";

export const ACCOUNT_ACTIVITY_ENTITY = { INCOME: "INCOME", EXPENSE: "EXPENSE" } as const;
export const REPORT_ROW_LIMIT = 365;
