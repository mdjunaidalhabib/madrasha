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
    library: "লাইব্রেরি",
    website: "ওয়েবসাইট",
    madrasa: "মাদ্রাসা",
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
    library: "Library",
    website: "Website",
    madrasa: "Madrasa",
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
    library: "المكتبة",
    website: "الموقع",
    madrasa: "المدرسة",
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

  // Fee / Invoices
  { key: "invoices/pending/clear|CREATE", bn: "বকেয়া ইনভয়েস ক্লিয়ার করা হয়েছে", en: "Pending invoices cleared", ar: "تم تصفية الفواتير المعلقة" },

  // Payroll
  { key: "payroll/generate|CREATE", bn: "বেতন (পেরোল) তৈরি করা হয়েছে", en: "Payroll generated", ar: "تم إنشاء كشف الرواتب" },
  { key: "payroll/pay|UPDATE", bn: "বেতন পরিশোধ করা হয়েছে", en: "Payroll paid", ar: "تم دفع الراتب" },

  // Promotion
  { key: "promotion/preview|CREATE", bn: "প্রমোশনের প্রিভিউ দেখা হয়েছে", en: "Promotion previewed", ar: "تمت معاينة الترقية" },
  { key: "promotion/execute|CREATE", bn: "শিক্ষার্থীদের প্রমোশন কার্যকর করা হয়েছে", en: "Student promotion executed", ar: "تم تنفيذ ترقية الطلاب" },

  // Students
  { key: "students/admission|CREATE", bn: "নতুন শিক্ষার্থী ভর্তি করা হয়েছে", en: "Student admitted", ar: "تم قبول طالب جديد" },
  { key: "students/admission/bulk|CREATE", bn: "একাধিক শিক্ষার্থী একসাথে (বাল্ক) ভর্তি করা হয়েছে", en: "Students bulk admitted", ar: "تم قبول عدة طلاب دفعة واحدة" },
  { key: "students/bulk-update|CREATE", bn: "একাধিক শিক্ষার্থীর তথ্য একসাথে হালনাগাদ করা হয়েছে", en: "Students bulk updated", ar: "تم تحديث بيانات عدة طلاب دفعة واحدة" },
  { key: "students/approve|UPDATE", bn: "শিক্ষার্থীর ভর্তি অনুমোদন করা হয়েছে", en: "Student admission approved", ar: "تمت الموافقة على قبول الطالب" },
  { key: "students/reject|UPDATE", bn: "শিক্ষার্থীর ভর্তি বাতিল করা হয়েছে", en: "Student admission rejected", ar: "تم رفض قبول الطالب" },
  { key: "students/expel|UPDATE", bn: "শিক্ষার্থীকে বহিষ্কার করা হয়েছে", en: "Student expelled", ar: "تم فصل الطالب" },
  { key: "students/transfer-session|UPDATE", bn: "শিক্ষার্থীকে নতুন শিক্ষাবর্ষে স্থানান্তর করা হয়েছে", en: "Student transferred to new session", ar: "تم نقل الطالب إلى عام دراسي جديد" },
  { key: "students/bulk|DELETE", bn: "একাধিক শিক্ষার্থী ট্র্যাশে সরানো হয়েছে", en: "Students moved to trash in bulk", ar: "تم نقل عدة طلاب إلى سلة المهملات" },

  // Teachers
  { key: "teachers/bulk|CREATE", bn: "একাধিক শিক্ষক একসাথে (বাল্ক) যোগ করা হয়েছে", en: "Teachers bulk added", ar: "تمت إضافة عدة معلمين دفعة واحدة" },
  { key: "teachers/bulk-update|CREATE", bn: "একাধিক শিক্ষকের তথ্য একসাথে হালনাগাদ করা হয়েছে", en: "Teachers bulk updated", ar: "تم تحديث بيانات عدة معلمين دفعة واحدة" },

  // Teacher assignments
  { key: "teacher-assignments/delete|CREATE", bn: "শিক্ষক বণ্টন মুছে ফেলা হয়েছে", en: "Teacher assignment deleted", ar: "تم حذف توزيع المعلم" },

  // ResultPanel
  { key: "results/session|CREATE", bn: "ফলাফলের সেশন তৈরি করা হয়েছে", en: "Result session created", ar: "تم إنشاء جلسة النتائج" },
  { key: "results/marks|CREATE", bn: "পরীক্ষার নম্বর সংরক্ষণ করা হয়েছে", en: "Marks saved", ar: "تم حفظ الدرجات" },
  { key: "results/process|CREATE", bn: "ফলাফল প্রসেস করা হয়েছে", en: "Result processed", ar: "تمت معالجة النتيجة" },
  { key: "results/publish|CREATE", bn: "ফলাফল প্রকাশ করা হয়েছে", en: "Result published", ar: "تم نشر النتيجة" },
  { key: "results/apply-roll-by-rank|CREATE", bn: "মেধাক্রম অনুযায়ী রোল নম্বর দেওয়া হয়েছে", en: "Roll numbers applied by rank", ar: "تم تطبيق أرقام الجلوس حسب الترتيب" },

  // Attendance / Kiosk
  { key: "attendance/bulk|CREATE", bn: "একসাথে অনেক শিক্ষার্থীর হাজিরা দেওয়া হয়েছে", en: "Attendance bulk marked", ar: "تم تسجيل حضور عدة طلاب دفعة واحدة" },
  { key: "attendance/kiosk/devices|CREATE", bn: "কিয়স্ক ডিভাইস যোগ করা হয়েছে", en: "Kiosk device added", ar: "تمت إضافة جهاز الكشك" },
  { key: "attendance/kiosk/devices|UPDATE", bn: "কিয়স্ক ডিভাইস হালনাগাদ করা হয়েছে", en: "Kiosk device updated", ar: "تم تحديث جهاز الكشك" },
  { key: "attendance/kiosk/devices|DELETE", bn: "কিয়স্ক ডিভাইস মুছে ফেলা হয়েছে", en: "Kiosk device deleted", ar: "تم حذف جهاز الكشك" },
  { key: "attendance/kiosk/students/card|UPDATE", bn: "শিক্ষার্থীর কার্ড/ফিঙ্গারপ্রিন্ট সংযুক্ত করা হয়েছে", en: "Student card/fingerprint assigned", ar: "تم ربط بطاقة/بصمة الطالب" },

  // Library
  { key: "library/categories|CREATE", bn: "লাইব্রেরি ক্যাটাগরি যোগ করা হয়েছে", en: "Library category added", ar: "تمت إضافة فئة المكتبة" },
  { key: "library/categories|UPDATE", bn: "লাইব্রেরি ক্যাটাগরি হালনাগাদ করা হয়েছে", en: "Library category updated", ar: "تم تحديث فئة المكتبة" },
  { key: "library/categories|DELETE", bn: "লাইব্রেরি ক্যাটাগরি মুছে ফেলা হয়েছে", en: "Library category deleted", ar: "تم حذف فئة المكتبة" },
  { key: "library/books|CREATE", bn: "লাইব্রেরিতে বই যোগ করা হয়েছে", en: "Library book added", ar: "تمت إضافة كتاب إلى المكتبة" },
  { key: "library/books|UPDATE", bn: "বইয়ের তথ্য হালনাগাদ করা হয়েছে", en: "Library book updated", ar: "تم تحديث بيانات الكتاب" },
  { key: "library/books|DELETE", bn: "বই মুছে ফেলা হয়েছে", en: "Library book deleted", ar: "تم حذف الكتاب" },
  { key: "library/borrow-records|CREATE", bn: "বই ইস্যু করা হয়েছে", en: "Book issued", ar: "تم إعارة الكتاب" },
  { key: "library/borrow-records/return|CREATE", bn: "বই ফেরত নেওয়া হয়েছে", en: "Book returned", ar: "تم إرجاع الكتاب" },
  { key: "library/borrow-records/mark-lost|CREATE", bn: "বই হারানো হিসেবে চিহ্নিত করা হয়েছে", en: "Book marked as lost", ar: "تم تحديد الكتاب كمفقود" },
  { key: "library/borrow-records/settle-fine|CREATE", bn: "লাইব্রেরির জরিমানা পরিশোধ করা হয়েছে", en: "Library fine settled", ar: "تمت تسوية غرامة المكتبة" },
  { key: "library/settings/fine-per-day|CREATE", bn: "লাইব্রেরির প্রতিদিনের জরিমানার হার নির্ধারণ করা হয়েছে", en: "Library fine-per-day rate set", ar: "تم تحديد غرامة المكتبة اليومية" },

  // Settings
  { key: "settings/branding|UPDATE", bn: "ব্র্যান্ডিং সেটিংস হালনাগাদ করা হয়েছে", en: "Branding settings updated", ar: "تم تحديث إعدادات العلامة التجارية" },
  { key: "settings/branding/logo|DELETE", bn: "লোগো মুছে ফেলা হয়েছে", en: "Logo removed", ar: "تم حذف الشعار" },
  { key: "settings/branding/banner|DELETE", bn: "ব্যানার মুছে ফেলা হয়েছে", en: "Banner removed", ar: "تم حذف اللافتة" },
  { key: "settings/branding/watermark|DELETE", bn: "ওয়াটারমার্ক মুছে ফেলা হয়েছে", en: "Watermark removed", ar: "تم حذف العلامة المائية" },
  { key: "settings/document-templates|UPDATE", bn: "ডকুমেন্ট টেমপ্লেট সেটিংস হালনাগাদ করা হয়েছে", en: "Document template settings updated", ar: "تم تحديث إعدادات قوالب المستندات" },
  { key: "settings/id-card-design|UPDATE", bn: "আইডি কার্ডের ডিজাইন হালনাগাদ করা হয়েছে", en: "ID card design updated", ar: "تم تحديث تصميم بطاقة الهوية" },
  { key: "settings/admit-card-design|UPDATE", bn: "এডমিট কার্ডের ডিজাইন হালনাগাদ করা হয়েছে", en: "Admit card design updated", ar: "تم تحديث تصميم بطاقة الدخول" },
  { key: "settings/letter-design|UPDATE", bn: "চিঠির ডিজাইন হালনাগাদ করা হয়েছে", en: "Letter design updated", ar: "تم تحديث تصميم الخطاب" },
  { key: "settings/book-label-design|UPDATE", bn: "বই-লেবেলের ডিজাইন হালনাগাদ করা হয়েছে", en: "Book label design updated", ar: "تم تحديث تصميم ملصق الكتاب" },

  // Public website
  { key: "website/admin/settings|UPDATE", bn: "ওয়েবসাইট সেটিংস হালনাগাদ করা হয়েছে", en: "Website settings updated", ar: "تم تحديث إعدادات الموقع" },
  { key: "website/admin/pages|UPDATE", bn: "ওয়েবসাইট পেজ হালনাগাদ করা হয়েছে", en: "Website page updated", ar: "تم تحديث صفحة الموقع" },
  { key: "website/admin/notices|CREATE", bn: "ওয়েবসাইট নোটিশ যোগ করা হয়েছে", en: "Website notice added", ar: "تمت إضافة إشعار الموقع" },
  { key: "website/admin/notices|DELETE", bn: "ওয়েবসাইট নোটিশ মুছে ফেলা হয়েছে", en: "Website notice deleted", ar: "تم حذف إشعار الموقع" },
  { key: "website/admin/gallery|CREATE", bn: "গ্যালারিতে ছবি যোগ করা হয়েছে", en: "Gallery photo added", ar: "تمت إضافة صورة إلى المعرض" },
  { key: "website/admin/gallery|DELETE", bn: "গ্যালারি থেকে ছবি মুছে ফেলা হয়েছে", en: "Gallery photo deleted", ar: "تم حذف صورة من المعرض" },
  { key: "website/admin/slides|CREATE", bn: "হিরো স্লাইড যোগ করা হয়েছে", en: "Hero slide added", ar: "تمت إضافة شريحة العرض الرئيسية" },
  { key: "website/admin/slides|DELETE", bn: "হিরো স্লাইড মুছে ফেলা হয়েছে", en: "Hero slide deleted", ar: "تم حذف شريحة العرض الرئيسية" },
  { key: "website/admin/committee|CREATE", bn: "কমিটির সদস্য যোগ করা হয়েছে", en: "Committee member added", ar: "تمت إضافة عضو اللجنة" },
  { key: "website/admin/committee|DELETE", bn: "কমিটির সদস্য মুছে ফেলা হয়েছে", en: "Committee member deleted", ar: "تم حذف عضو اللجنة" },
  { key: "website/admin/admissions/status|UPDATE", bn: "ভর্তি আবেদনের অবস্থা পরিবর্তন করা হয়েছে", en: "Admission application status changed", ar: "تم تغيير حالة طلب القبول" },
  { key: "website/admin/admissions|DELETE", bn: "ভর্তি আবেদন মুছে ফেলা হয়েছে", en: "Admission application deleted", ar: "تم حذف طلب القبول" },

  // Document templates (custom action strings, not plain CREATE/UPDATE/DELETE)
  { key: "documenttemplate|DOCUMENT_TEMPLATE.CREATE", bn: "ডকুমেন্ট টেমপ্লেট তৈরি করা হয়েছে", en: "Document template created", ar: "تم إنشاء قالب المستند" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.CLONE", bn: "ডকুমেন্ট টেমপ্লেট কপি (ক্লোন) করা হয়েছে", en: "Document template cloned", ar: "تم استنساخ قالب المستند" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.PUBLISH", bn: "ডকুমেন্ট টেমপ্লেট প্রকাশ করা হয়েছে", en: "Document template published", ar: "تم نشر قالب المستند" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.UPDATE", bn: "ডকুমেন্ট টেমপ্লেট হালনাগাদ করা হয়েছে", en: "Document template updated", ar: "تم تحديث قالب المستند" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.DELETE", bn: "ডকুমেন্ট টেমপ্লেট মুছে ফেলা হয়েছে", en: "Document template deleted", ar: "تم حذف قالب المستند" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.SET_SYSTEM_DEFAULT", bn: "সিস্টেম ডিফল্ট টেমপ্লেট নির্ধারণ করা হয়েছে", en: "System default template set", ar: "تم تعيين القالب الافتراضي للنظام" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.SET_TENANT_DEFAULT", bn: "মাদ্রাসার ডিফল্ট টেমপ্লেট নির্ধারণ করা হয়েছে", en: "Madrasa default template set", ar: "تم تعيين القالب الافتراضي للمدرسة" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.AUTO_MIGRATED", bn: "টেমপ্লেট স্বয়ংক্রিয়ভাবে মাইগ্রেট করা হয়েছে", en: "Template auto-migrated", ar: "تمت ترقية القالب تلقائيًا" },

  // Super-admin actions visible in a tenant's own log
  { key: "madrasa|MADRASA_CREATED", bn: "মাদ্রাসা তৈরি করা হয়েছে", en: "Madrasa created", ar: "تم إنشاء المدرسة" },
  { key: "madrasa|SUPER_ADMIN_MADRASA_UPDATED", bn: "মাদ্রাসার তথ্য হালনাগাদ করা হয়েছে (সুপার এডমিন)", en: "Madrasa updated (super admin)", ar: "تم تحديث بيانات المدرسة (المشرف العام)" },
  { key: "user|SUPER_ADMIN_USER_CREATED", bn: "নতুন ইউজার তৈরি করা হয়েছে (সুপার এডমিন)", en: "User created (super admin)", ar: "تم إنشاء مستخدم (المشرف العام)" },
  { key: "user|SUPER_ADMIN_USER_DELETED", bn: "ইউজার মুছে ফেলা হয়েছে (সুপার এডমিন)", en: "User deleted (super admin)", ar: "تم حذف المستخدم (المشرف العام)" },

  // Talimat
  { key: "talimat/create|CREATE", bn: "তালিমাত যোগ করা হয়েছে", en: "Talimat added", ar: "تمت إضافة التعليمات" },
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
