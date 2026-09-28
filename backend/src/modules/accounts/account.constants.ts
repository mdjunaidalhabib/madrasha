import { t } from "../../shared/i18n";
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

export const DEFAULT_EXPENSE_GROUPS = [
  { name: "সাধারণ ব্যয় বিভাগ", categories: DEFAULT_EXPENSE_CATEGORIES },
  { name: "মসজিদ ব্যয়", categories: DEFAULT_MOSQUE_EXPENSES },
  { name: "কবরস্থান ব্যয়", categories: DEFAULT_GRAVEYARD_EXPENSES },
];

export const PAYMENT_METHODS = ["নগদ টাকা", "ব্যাংক / মোবাইল ব্যাংকিং"];

export const INCOME_VALIDATION_MESSAGE = (): string =>
  t({ bn: "নাম, ফান্ড, খাত, পরিমাণ ও পেমেন্ট মাধ্যম বাধ্যতামূলক", en: "Name, fund, category, amount and payment method are required", ar: "الاسم والصندوق والبند والمبلغ وطريقة الدفع مطلوبة" });
export const EXPENSE_VALIDATION_MESSAGE = (): string =>
  t({ bn: "নাম, ফান্ড, ব্যয়ের খাত, পরিমাণ ও পেমেন্ট মাধ্যম বাধ্যতামূলক", en: "Name, fund, expense category, amount and payment method are required", ar: "الاسم والصندوق وبند المصروف والمبلغ وطريقة الدفع مطلوبة" });
export const INCOME_SUCCESS_MESSAGE = (): string =>
  t({ bn: "আয় এন্ট্রি সফল হয়েছে", en: "Income entry saved", ar: "تم تسجيل الدخل بنجاح" });
export const EXPENSE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "ব্যয় এন্ট্রি সফল হয়েছে", en: "Expense entry saved", ar: "تم تسجيل المصروف بنجاح" });
export const ACCOUNT_UPDATE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "এন্ট্রি আপডেট হয়েছে", en: "Entry updated", ar: "تم تحديث القيد" });
export const ACCOUNT_DELETE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "এন্ট্রি মুছে ফেলা হয়েছে", en: "Entry deleted", ar: "تم حذف القيد" });
export const ACCOUNT_NOT_FOUND_MESSAGE = (): string =>
  t({ bn: "এন্ট্রি খুঁজে পাওয়া যায়নি", en: "Entry not found", ar: "لم يتم العثور على القيد" });

export const FUND_VALIDATION_MESSAGE = (): string =>
  t({ bn: "নাম বাধ্যতামূলক", en: "Name is required", ar: "الاسم مطلوب" });
export const FUND_NOT_FOUND_MESSAGE = (): string =>
  t({ bn: "ফান্ড/বিভাগ খুঁজে পাওয়া যায়নি", en: "Fund/group not found", ar: "لم يتم العثور على الصندوق/المجموعة" });
export const CATEGORY_NOT_FOUND_MESSAGE = (): string =>
  t({ bn: "খাত খুঁজে পাওয়া যায়নি", en: "Category not found", ar: "لم يتم العثور على البند" });
export const FUND_CREATE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "ফান্ড/বিভাগ যোগ করা হয়েছে", en: "Fund/group added", ar: "تمت إضافة الصندوق/المجموعة" });
export const FUND_UPDATE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "ফান্ড/বিভাগ আপডেট হয়েছে", en: "Fund/group updated", ar: "تم تحديث الصندوق/المجموعة" });
export const FUND_DELETE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "ফান্ড/বিভাগ মুছে ফেলা হয়েছে", en: "Fund/group deleted", ar: "تم حذف الصندوق/المجموعة" });
export const CATEGORY_CREATE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "খাত যোগ করা হয়েছে", en: "Category added", ar: "تمت إضافة البند" });
export const CATEGORY_UPDATE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "খাত আপডেট হয়েছে", en: "Category updated", ar: "تم تحديث البند" });
export const CATEGORY_DELETE_SUCCESS_MESSAGE = (): string =>
  t({ bn: "খাত মুছে ফেলা হয়েছে", en: "Category deleted", ar: "تم حذف البند" });

export const ACCOUNT_ACTIVITY_ENTITY = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  FUND: "FUND_SETTINGS",
  CATEGORY: "CATEGORY_SETTINGS",
} as const;
export const REPORT_ROW_LIMIT = 365;
export const ACCOUNT_LIST_ROW_LIMIT = 500;
export const RECEIPT_NO_PREFIX = "RC";
export const VOUCHER_NO_PREFIX = "VC";
