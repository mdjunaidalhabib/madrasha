import type { Lang } from "../../store/languageStore";

export type ActivityLogText = {
  title: string;
  subtitle: string;
  quickRangeLabel: string;
  customRangeLabel: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
  clearLabel: string;
  colUser: string;
  colAction: string;
  colEntity: string;
  colDetails: string;
  colTime: string;
  systemUser: string;
  noDetails: string;
  empty: string;
  loadError: string;
  totalLabel: (n: string) => string;
  pageLabel: (page: string, totalPages: string) => string;
  prevPage: string;
  nextPage: string;
  retentionNote: (days: string) => string;
  dayOption: (n: number) => string;
};

export const activityLogText: Record<Lang, ActivityLogText> = {
  bn: {
    title: "অ্যাক্টিভিটি লগ",
    subtitle: "ওয়েবসাইটে যা কিছু করা হয়েছে তার সম্পূর্ণ ইতিহাস",
    quickRangeLabel: "সময়সীমা",
    customRangeLabel: "নির্দিষ্ট তারিখ",
    fromLabel: "শুরুর তারিখ",
    toLabel: "শেষ তারিখ",
    applyLabel: "প্রয়োগ করুন",
    clearLabel: "রিসেট",
    colUser: "ব্যবহারকারী",
    colAction: "কার্যক্রম",
    colEntity: "বিষয়",
    colDetails: "বিস্তারিত",
    colTime: "সময়",
    systemUser: "সিস্টেম",
    noDetails: "—",
    empty: "এই সময়সীমায় কোনো অ্যাক্টিভিটি পাওয়া যায়নি",
    loadError: "লগ লোড করা যায়নি",
    totalLabel: (n) => `মোট ${n} টি লগ`,
    pageLabel: (page, totalPages) => `পৃষ্ঠা ${page} / ${totalPages}`,
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
    retentionNote: (days) => `${days} দিনের পুরনো লগ স্বয়ংক্রিয়ভাবে মুছে যায়`,
    dayOption: (n) => `${n} দিন`,
  },
  en: {
    title: "Activity Log",
    subtitle: "Full history of everything done on the website",
    quickRangeLabel: "Time range",
    customRangeLabel: "Custom range",
    fromLabel: "From date",
    toLabel: "To date",
    applyLabel: "Apply",
    clearLabel: "Reset",
    colUser: "User",
    colAction: "Action",
    colEntity: "Entity",
    colDetails: "Details",
    colTime: "Time",
    systemUser: "System",
    noDetails: "—",
    empty: "No activity found in this range",
    loadError: "Failed to load logs",
    totalLabel: (n) => `${n} logs total`,
    pageLabel: (page, totalPages) => `Page ${page} / ${totalPages}`,
    prevPage: "Previous",
    nextPage: "Next",
    retentionNote: (days) => `Logs older than ${days} days are deleted automatically`,
    dayOption: (n) => `${n} days`,
  },
  ar: {
    title: "سجل النشاط",
    subtitle: "السجل الكامل لكل ما تم عمله على الموقع",
    quickRangeLabel: "الفترة الزمنية",
    customRangeLabel: "نطاق مخصص",
    fromLabel: "من تاريخ",
    toLabel: "إلى تاريخ",
    applyLabel: "تطبيق",
    clearLabel: "إعادة تعيين",
    colUser: "المستخدم",
    colAction: "الإجراء",
    colEntity: "العنصر",
    colDetails: "التفاصيل",
    colTime: "الوقت",
    systemUser: "النظام",
    noDetails: "—",
    empty: "لا يوجد نشاط في هذه الفترة",
    loadError: "تعذر تحميل السجلات",
    totalLabel: (n) => `إجمالي ${n} سجل`,
    pageLabel: (page, totalPages) => `صفحة ${page} / ${totalPages}`,
    prevPage: "السابق",
    nextPage: "التالي",
    retentionNote: (days) => `يتم حذف السجلات الأقدم من ${days} يومًا تلقائيًا`,
    dayOption: (n) => `${n} يوم`,
  },
};

export const QUICK_DAY_OPTIONS = [3, 5, 7, 15, 30, 60, 90] as const;

type LangMap = Record<Lang, Record<string, string>>;

// Base noun per top-level entity (first path segment the backend derives -
// see activityLogger.middleware.ts). Anything not listed here falls back to
// a humanized version of the raw entity string.
const ENTITY_NOUNS: LangMap = {
  bn: {
    students: "শিক্ষার্থী",
    teachers: "শিক্ষক",
    "teacher-assignments": "শিক্ষক বণ্টন",
    exams: "পরীক্ষা",
    "general-grades": "সাধারণ গ্রেড",
    "madrasa-grades": "মাদরাসা গ্রেড",
    "fail-mark": "ফেল মার্ক",
    "class-routine": "ক্লাস রুটিন",
    "exam-routine": "পরীক্ষার রুটিন",
    "fee-structures": "ফি কাঠামো",
    invoices: "ইনভয়েস",
    "payment-methods": "পেমেন্ট পদ্ধতি",
    roles: "রোল",
    permissions: "পারমিশন",
    notifications: "নোটিফিকেশন",
    uploads: "ফাইল",
    "madrasa-divisions": "বিভাগ",
    "madrasa-classes": "শ্রেণি",
    "madrasa-books": "বিষয়/কিতাব",
    attendance: "হাজিরা",
    promotion: "প্রমোশন",
    sessions: "শিক্ষাবর্ষ",
    payroll: "বেতন",
    talimat: "তালিমাত",
    results: "ফলাফল",
    reports: "রিপোর্ট",
    settings: "সেটিংস",
    guardian: "অভিভাবক পোর্টাল",
    trash: "ট্র্যাশ",
    auth: "প্রোফাইল",
    income: "আয়",
    expense: "ব্যয়",
    user: "ইউজার",
    documenttemplate: "ডকুমেন্ট টেমপ্লেট",
  },
  en: {
    students: "Student",
    teachers: "Teacher",
    "teacher-assignments": "Teacher Assignment",
    exams: "Exam",
    "general-grades": "General Grade",
    "madrasa-grades": "Madrasa Grade",
    "fail-mark": "Fail Mark",
    "class-routine": "Class Routine",
    "exam-routine": "Exam Routine",
    "fee-structures": "Fee Structure",
    invoices: "Invoice",
    "payment-methods": "Payment Method",
    roles: "Role",
    permissions: "Permission",
    notifications: "Notification",
    uploads: "File",
    "madrasa-divisions": "Division",
    "madrasa-classes": "Class",
    "madrasa-books": "Subject/Book",
    attendance: "Attendance",
    promotion: "Promotion",
    sessions: "Session",
    payroll: "Payroll",
    talimat: "Talimat",
    results: "Result",
    reports: "Report",
    settings: "Settings",
    guardian: "Guardian Portal",
    trash: "Trash",
    auth: "Profile",
    income: "Income",
    expense: "Expense",
    user: "User",
    documenttemplate: "Document Template",
  },
  ar: {
    students: "طالب",
    teachers: "معلم",
    "teacher-assignments": "توزيع المعلمين",
    exams: "امتحان",
    "general-grades": "الدرجات العامة",
    "madrasa-grades": "درجات المدرسة",
    "fail-mark": "علامة الرسوب",
    "class-routine": "جدول الحصص",
    "exam-routine": "جدول الامتحانات",
    "fee-structures": "هيكل الرسوم",
    invoices: "فاتورة",
    "payment-methods": "طريقة الدفع",
    roles: "الدور",
    permissions: "الصلاحية",
    notifications: "إشعار",
    uploads: "ملف",
    "madrasa-divisions": "القسم",
    "madrasa-classes": "الصف",
    "madrasa-books": "المادة",
    attendance: "الحضور",
    promotion: "الترقية",
    sessions: "العام الدراسي",
    payroll: "كشف الرواتب",
    talimat: "تعليمات",
    results: "النتيجة",
    reports: "تقرير",
    settings: "الإعدادات",
    guardian: "بوابة ولي الأمر",
    trash: "سلة المهملات",
    auth: "الملف الشخصي",
    income: "الدخل",
    expense: "المصروف",
    user: "مستخدم",
    documenttemplate: "قالب المستند",
  },
};

const ACTION_VERBS: Record<Lang, Record<string, (noun: string) => string>> = {
  bn: {
    CREATE: (n) => `${n} যোগ করা হয়েছে`,
    UPDATE: (n) => `${n} হালনাগাদ করা হয়েছে`,
    DELETE: (n) => `${n} মুছে ফেলা হয়েছে`,
  },
  en: {
    CREATE: (n) => `${n} created`,
    UPDATE: (n) => `${n} updated`,
    DELETE: (n) => `${n} deleted`,
  },
  ar: {
    CREATE: (n) => `تمت إضافة ${n}`,
    UPDATE: (n) => `تم تحديث ${n}`,
    DELETE: (n) => `تم حذف ${n}`,
  },
};

// Exact "entity|ACTION" phrases for actions that read badly as generic
// "<noun> created/updated/deleted" - keyed on the full entity path the
// backend derives (e.g. "invoices/pay"), not just the base noun above.
const SPECIAL_LABEL_ROWS: Array<{ key: string; bn: string; en: string; ar: string }> = [
  { key: "invoices/pay|CREATE", bn: "ইনভয়েস পরিশোধ করা হয়েছে", en: "Invoice paid", ar: "تم دفع الفاتورة" },
  { key: "invoices/waive|CREATE", bn: "ইনভয়েস মওকুফ করা হয়েছে", en: "Invoice waived", ar: "تم إعفاء الفاتورة" },
  { key: "invoices/generate|CREATE", bn: "ইনভয়েস তৈরি করা হয়েছে", en: "Invoices generated", ar: "تم إنشاء الفواتير" },
  {
    key: "invoices/backfill|CREATE",
    bn: "পুরনো ইনভয়েস তৈরি করা হয়েছে (ব্যাকফিল)",
    en: "Invoices backfilled",
    ar: "تم إنشاء الفواتير القديمة",
  },
  { key: "exams/reorder|UPDATE", bn: "পরীক্ষার ক্রম পরিবর্তন করা হয়েছে", en: "Exam order changed", ar: "تم تغيير ترتيب الامتحانات" },
  {
    key: "madrasa-divisions/reorder|UPDATE",
    bn: "বিভাগের ক্রম পরিবর্তন করা হয়েছে",
    en: "Division order changed",
    ar: "تم تغيير ترتيب الأقسام",
  },
  {
    key: "madrasa-classes/reorder|UPDATE",
    bn: "শ্রেণির ক্রম পরিবর্তন করা হয়েছে",
    en: "Class order changed",
    ar: "تم تغيير ترتيب الصفوف",
  },
  {
    key: "madrasa-books/reorder|UPDATE",
    bn: "বিষয়ের ক্রম পরিবর্তন করা হয়েছে",
    en: "Subject order changed",
    ar: "تم تغيير ترتيب المواد",
  },
  {
    key: "madrasa-books/miyari|UPDATE",
    bn: "মিয়ারি বিষয় হালনাগাদ করা হয়েছে",
    en: "Standard subjects updated",
    ar: "تم تحديث المواد المعيارية",
  },
  { key: "auth/change-password|CREATE", bn: "পাসওয়ার্ড পরিবর্তন করা হয়েছে", en: "Password changed", ar: "تم تغيير كلمة المرور" },
  { key: "auth/me|UPDATE", bn: "নিজের প্রোফাইল হালনাগাদ করা হয়েছে", en: "Own profile updated", ar: "تم تحديث الملف الشخصي" },
  { key: "auth/unlock|CREATE", bn: "স্ক্রিন আনলক করা হয়েছে", en: "Screen unlocked", ar: "تم فتح الشاشة" },
  { key: "uploads/image|CREATE", bn: "ছবি আপলোড করা হয়েছে", en: "Image uploaded", ar: "تم رفع الصورة" },
  { key: "uploads/image|DELETE", bn: "ছবি মুছে ফেলা হয়েছে", en: "Image deleted", ar: "تم حذف الصورة" },
  { key: "notifications/send|CREATE", bn: "নোটিফিকেশন পাঠানো হয়েছে", en: "Notification sent", ar: "تم إرسال الإشعار" },
  ...(["students", "teachers", "exams", "divisions", "classes", "books", "results"] as const).flatMap((e) => {
    const noun = ENTITY_NOUNS.bn[e === "divisions" ? "madrasa-divisions" : e === "classes" ? "madrasa-classes" : e === "books" ? "madrasa-books" : e];
    const nounEn = ENTITY_NOUNS.en[e === "divisions" ? "madrasa-divisions" : e === "classes" ? "madrasa-classes" : e === "books" ? "madrasa-books" : e];
    const nounAr = ENTITY_NOUNS.ar[e === "divisions" ? "madrasa-divisions" : e === "classes" ? "madrasa-classes" : e === "books" ? "madrasa-books" : e];
    return [
      {
        key: `trash/${e}/restore|CREATE`,
        bn: `${noun} ট্র্যাশ থেকে পুনরুদ্ধার করা হয়েছে`,
        en: `${nounEn} restored from trash`,
        ar: `تمت استعادة ${nounAr} من سلة المهملات`,
      },
      {
        key: `trash/${e}|DELETE`,
        bn: `${noun} স্থায়ীভাবে মুছে ফেলা হয়েছে`,
        en: `${nounEn} permanently deleted`,
        ar: `تم حذف ${nounAr} نهائيًا`,
      },
    ];
  }),
];

const SPECIAL_LABELS: LangMap = { bn: {}, en: {}, ar: {} };
for (const row of SPECIAL_LABEL_ROWS) {
  SPECIAL_LABELS.bn[row.key] = row.bn;
  SPECIAL_LABELS.en[row.key] = row.en;
  SPECIAL_LABELS.ar[row.key] = row.ar;
}

function humanize(value: string): string {
  return value
    .split("/")
    .join(" ")
    .split(/[-_.]/)
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turns a raw {entity, action} activity-log row into a readable sentence in the given language. */
export function translateActivityAction(entity: string, action: string, lang: Lang): string {
  const normEntity = (entity || "").toLowerCase();
  const normAction = (action || "").toUpperCase();

  const special = SPECIAL_LABELS[lang][`${normEntity}|${normAction}`];
  if (special) return special;

  const baseEntity = normEntity.split("/")[0];
  const noun = ENTITY_NOUNS[lang][baseEntity] ?? humanize(normEntity);
  const verb = ACTION_VERBS[lang][normAction] ?? ACTION_VERBS[lang].UPDATE;
  return verb(noun);
}

/** Human-readable label for the raw entity string (used for the "Entity" column). */
export function translateEntityName(entity: string, lang: Lang): string {
  const normEntity = (entity || "").toLowerCase();
  const baseEntity = normEntity.split("/")[0];
  return ENTITY_NOUNS[lang][baseEntity] ?? humanize(normEntity);
}
