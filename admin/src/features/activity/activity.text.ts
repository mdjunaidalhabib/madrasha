import { defineText, formatNumber, getText, localizeDigits, type Lang } from "@madrasha/shared-ui/src/i18n";

// Activity-log UI text + the dictionaries that turn a raw {entity, action}
// log row into a readable sentence. Values may use {{term}} placeholders
// (institution vocabulary), filled per institution type by useText/getText.

export const QUICK_DAY_OPTIONS = [3, 5, 7, 15, 30, 60, 90] as const;

type SpecialRow = { key: string; bn: string; en: string };

// Base noun per top-level entity (first path segment the backend derives -
// see activityLogger.middleware.ts). Anything not listed here falls back to
// a humanized version of the raw entity string.
const ENTITY_NOUNS: Record<"bn" | "en", Record<string, string>> = {
  bn: {
    students: "{{student}}",
    teachers: "{{teacher}}",
    "teacher-assignments": "{{teacher}} বণ্টন",
    exams: "পরীক্ষা",
    "general-grades": "সাধারণ গ্রেড",
    "madrasa-grades": "মাদরাসা গ্রেড",
    "fail-mark": "ফেল মার্ক",
    "class-routine": "ক্লাস রুটিন",
    "exam-routine": "পরীক্ষার রুটিন",
    "fee-structures": "ফি কাঠামো",
    "fee-categories": "ফি ধরণ",
    invoices: "ইনভয়েস",
    "payment-methods": "পেমেন্ট পদ্ধতি",
    roles: "রোল",
    permissions: "পারমিশন",
    notifications: "নোটিফিকেশন",
    uploads: "ফাইল",
    "madrasa-divisions": "{{division}}",
    "madrasa-classes": "{{class}}",
    "madrasa-books": "{{subject}}",
    attendance: "হাজিরা",
    promotion: "প্রমোশন",
    sessions: "{{session}}",
    payroll: "বেতন",
    talimat: "{{academic}}",
    results: "ফলাফল",
    reports: "রিপোর্ট",
    settings: "সেটিংস",
    guardian: "অভিভাবক পোর্টাল",
    trash: "ট্র্যাশ",
    auth: "প্রোফাইল",
    security: "লগইন ও নিরাপত্তা",
    income: "আয়",
    expense: "ব্যয়",
    user: "ইউজার",
    documenttemplate: "ডকুমেন্ট টেমপ্লেট",
    library: "লাইব্রেরি",
    website: "ওয়েবসাইট",
    madrasa: "{{institution}}",
  },
  en: {
    students: "{{student}}",
    teachers: "{{teacher}}",
    "teacher-assignments": "{{teacher}} Assignment",
    exams: "Exam",
    "general-grades": "General Grade",
    "madrasa-grades": "Madrasa Grade",
    "fail-mark": "Fail Mark",
    "class-routine": "Class Routine",
    "exam-routine": "Exam Routine",
    "fee-structures": "Fee Structure",
    "fee-categories": "Fee Category",
    invoices: "Invoice",
    "payment-methods": "Payment Method",
    roles: "Role",
    permissions: "Permission",
    notifications: "Notification",
    uploads: "File",
    "madrasa-divisions": "{{division}}",
    "madrasa-classes": "{{class}}",
    "madrasa-books": "{{subject}}",
    attendance: "Attendance",
    promotion: "Promotion",
    sessions: "{{session}}",
    payroll: "Payroll",
    talimat: "{{academic}}",
    results: "Result",
    reports: "Report",
    settings: "Settings",
    guardian: "Guardian Portal",
    trash: "Trash",
    auth: "Profile",
    security: "Login & security",
    income: "Income",
    expense: "Expense",
    user: "User",
    documenttemplate: "Document Template",
    library: "Library",
    website: "Website",
    madrasa: "{{institution}}",
  },
};


// Exact "entity|ACTION" phrases for actions that read badly as generic
// "<noun> created/updated/deleted" - keyed on the full entity path the
// backend derives (e.g. "invoices/pay"), not just the base noun above.
const SPECIAL_LABEL_ROWS: SpecialRow[] = [
  { key: "invoices/pay|CREATE", bn: "ইনভয়েস পরিশোধ করা হয়েছে", en: "Invoice paid" },
  { key: "invoices/waive|CREATE", bn: "ইনভয়েস মওকুফ করা হয়েছে", en: "Invoice waived" },
  {
    key: "invoices/backfill|CREATE",
    bn: "পুরনো ইনভয়েস তৈরি করা হয়েছে (ব্যাকফিল)",
    en: "Invoices backfilled",
  },
  { key: "exams/reorder|UPDATE", bn: "পরীক্ষার ক্রম পরিবর্তন করা হয়েছে", en: "Exam order changed" },
  {
    key: "fee-structures/exam-fees|UPDATE",
    bn: "পরীক্ষার ফি-এর পরিমাণ হালনাগাদ করা হয়েছে",
    en: "Exam fee amounts updated",
  },
  {
    key: "fee-structures/exam-fees/status|UPDATE",
    bn: "পরীক্ষার ফি চালু/বন্ধ করা হয়েছে",
    en: "Exam fee switched on/off",
  },
  {
    key: "madrasa-divisions/reorder|UPDATE",
    bn: "{{division}}ের ক্রম পরিবর্তন করা হয়েছে",
    en: "{{division}} order changed",
  },
  {
    key: "madrasa-classes/reorder|UPDATE",
    bn: "{{class}}র ক্রম পরিবর্তন করা হয়েছে",
    en: "{{class}} order changed",
  },
  {
    key: "madrasa-books/reorder|UPDATE",
    bn: "{{subject}}ের ক্রম পরিবর্তন করা হয়েছে",
    en: "{{subject}} order changed",
  },
  {
    key: "madrasa-books/miyari|UPDATE",
    bn: "মিয়ারি {{subject}} হালনাগাদ করা হয়েছে",
    en: "Standard subjects updated",
  },
  { key: "auth/change-password|CREATE", bn: "পাসওয়ার্ড পরিবর্তন করা হয়েছে", en: "Password changed" },
  { key: "auth/me|UPDATE", bn: "নিজের প্রোফাইল হালনাগাদ করা হয়েছে", en: "Own profile updated" },
  { key: "auth/unlock|CREATE", bn: "স্ক্রিন আনলক করা হয়েছে", en: "Screen unlocked" },
  { key: "uploads/image|CREATE", bn: "ছবি আপলোড করা হয়েছে", en: "Image uploaded" },
  { key: "uploads/image|DELETE", bn: "ছবি মুছে ফেলা হয়েছে", en: "Image deleted" },
  { key: "notifications/send|CREATE", bn: "নোটিফিকেশন পাঠানো হয়েছে", en: "Notification sent" },
  ...(["students", "teachers", "exams", "divisions", "classes", "books", "results"] as const).flatMap((e) => {
    const key = e === "divisions" ? "madrasa-divisions" : e === "classes" ? "madrasa-classes" : e === "books" ? "madrasa-books" : e;
    const noun = ENTITY_NOUNS.bn[key];
    const nounEn = ENTITY_NOUNS.en[key];
    return [
      {
        key: `trash/${e}/restore|CREATE`,
        bn: `${noun} ট্র্যাশ থেকে পুনরুদ্ধার করা হয়েছে`,
        en: `${nounEn} restored from trash`,
      },
      {
        key: `trash/${e}|DELETE`,
        bn: `${noun} স্থায়ীভাবে মুছে ফেলা হয়েছে`,
        en: `${nounEn} permanently deleted`,
      },
    ];
  }),

  // Fee / Invoices
  { key: "invoices/pending/clear|CREATE", bn: "বকেয়া ইনভয়েস ক্লিয়ার করা হয়েছে", en: "Pending invoices cleared" },

  // Payroll
  { key: "payroll/generate|CREATE", bn: "বেতন (পেরোল) তৈরি করা হয়েছে", en: "Payroll generated" },
  { key: "payroll/pay|UPDATE", bn: "বেতন পরিশোধ করা হয়েছে", en: "Payroll paid" },

  // Promotion
  { key: "promotion/preview|CREATE", bn: "প্রমোশনের প্রিভিউ দেখা হয়েছে", en: "Promotion previewed" },
  { key: "promotion/execute|CREATE", bn: "{{student}}দের প্রমোশন কার্যকর করা হয়েছে", en: "{{student}} promotion executed" },

  // Students
  { key: "students/admission|CREATE", bn: "নতুন {{student}} ভর্তি করা হয়েছে", en: "{{student}} admitted" },
  { key: "students/admission/bulk|CREATE", bn: "একাধিক {{student}} একসাথে (বাল্ক) ভর্তি করা হয়েছে", en: "{{student}}s bulk admitted" },
  { key: "students/bulk-update|CREATE", bn: "একাধিক {{student}}র তথ্য একসাথে হালনাগাদ করা হয়েছে", en: "{{student}}s bulk updated" },
  { key: "students/approve|UPDATE", bn: "{{student}}র ভর্তি অনুমোদন করা হয়েছে", en: "{{student}} admission approved" },
  { key: "students/reject|UPDATE", bn: "{{student}}র ভর্তি বাতিল করা হয়েছে", en: "{{student}} admission rejected" },
  {
    key: "students/reapprove|UPDATE",
    bn: "বাতিল হওয়া ভর্তি আবেদন পুনরায় অনুমোদন করা হয়েছে",
    en: "Rejected admission re-approved",
  },
  { key: "students/expel|UPDATE", bn: "{{student}}কে বহিষ্কার করা হয়েছে", en: "{{student}} expelled" },
  { key: "students/transfer-session|UPDATE", bn: "{{student}}কে নতুন {{session}}ে স্থানান্তর করা হয়েছে", en: "{{student}} transferred to new {{session}}" },
  { key: "students|DELETE", bn: "{{student}} ট্র্যাশে সরানো হয়েছে", en: "{{student}} moved to trash" },
  { key: "teachers|DELETE", bn: "{{teacher}} ট্র্যাশে সরানো হয়েছে", en: "{{teacher}} moved to trash" },
  { key: "exams|DELETE", bn: "পরীক্ষা ট্র্যাশে সরানো হয়েছে", en: "Exam moved to trash" },
  {
    key: "students/rejected-application|DELETE",
    bn: "বাতিল হওয়া ভর্তি আবেদন মুছে ফেলা হয়েছে",
    en: "Rejected admission application deleted",
  },
  { key: "students/admission/approve-bulk|UPDATE", bn: "একাধিক {{student}}র ভর্তি একসাথে অনুমোদন করা হয়েছে", en: "{{student}} admissions bulk approved" },
  { key: "students/admission/reject-bulk|UPDATE", bn: "একাধিক {{student}}র ভর্তি একসাথে বাতিল করা হয়েছে", en: "{{student}} admissions bulk rejected" },
  {
    key: "students/admission/reapprove-bulk|UPDATE",
    bn: "একাধিক বাতিল হওয়া ভর্তি আবেদন একসাথে পুনরায় অনুমোদন করা হয়েছে",
    en: "Rejected admissions bulk re-approved",
  },
  { key: "students/admission/rejected-bulk|DELETE", bn: "একাধিক বাতিল হওয়া ভর্তি আবেদন মুছে ফেলা হয়েছে", en: "Rejected applications bulk deleted" },
  { key: "students/names|UPDATE", bn: "একাধিক {{student}}র নাম একসাথে হালনাগাদ করা হয়েছে", en: "{{student}} names bulk updated" },
  { key: "exam-attendance/bulk|CREATE", bn: "পরীক্ষার হাজিরা একসাথে দেওয়া হয়েছে", en: "Exam attendance bulk marked" },
  { key: "invoices/exam-fee/bulk-pay|CREATE", bn: "পরীক্ষার ফি একসাথে গ্রহণ করা হয়েছে", en: "Exam fees collected in bulk" },
  { key: "account|DELETE", bn: "আয়-ব্যয়ের একাধিক এন্ট্রি একসাথে মুছে ফেলা হয়েছে", en: "Income/expense entries bulk deleted" },
  { key: "students/bulk|DELETE", bn: "একাধিক {{student}} ট্র্যাশে সরানো হয়েছে", en: "{{student}}s moved to trash in bulk" },

  // Teachers
  { key: "teachers/bulk|CREATE", bn: "একাধিক {{teacher}} একসাথে (বাল্ক) যোগ করা হয়েছে", en: "{{teacher}}s bulk added" },
  { key: "teachers/bulk-update|CREATE", bn: "একাধিক {{teacher}}ের তথ্য একসাথে হালনাগাদ করা হয়েছে", en: "{{teacher}}s bulk updated" },

  // Teacher assignments
  { key: "teacher-assignments/delete|CREATE", bn: "{{teacher}} বণ্টন মুছে ফেলা হয়েছে", en: "{{teacher}} assignment deleted" },

  // ResultPanel
  { key: "results/session|CREATE", bn: "ফলাফলের সেশন তৈরি করা হয়েছে", en: "Result session created" },
  { key: "results/marks|CREATE", bn: "পরীক্ষার নম্বর সংরক্ষণ করা হয়েছে", en: "Marks saved" },
  { key: "results/process|CREATE", bn: "ফলাফল প্রসেস করা হয়েছে", en: "Result processed" },
  { key: "results/publish|CREATE", bn: "ফলাফল প্রকাশ করা হয়েছে", en: "Result published" },
  { key: "results/apply-roll-by-rank|CREATE", bn: "মেধাক্রম অনুযায়ী রোল নম্বর দেওয়া হয়েছে", en: "Roll numbers applied by rank" },

  // Attendance / Kiosk
  { key: "attendance/bulk|CREATE", bn: "একসাথে অনেক {{student}}র হাজিরা দেওয়া হয়েছে", en: "Attendance bulk marked" },
  { key: "attendance/kiosk/devices|CREATE", bn: "কিয়স্ক ডিভাইস যোগ করা হয়েছে", en: "Kiosk device added" },
  { key: "attendance/kiosk/devices|UPDATE", bn: "কিয়স্ক ডিভাইস হালনাগাদ করা হয়েছে", en: "Kiosk device updated" },
  { key: "attendance/kiosk/devices|DELETE", bn: "কিয়স্ক ডিভাইস মুছে ফেলা হয়েছে", en: "Kiosk device deleted" },
  { key: "attendance/kiosk/students/card|UPDATE", bn: "{{student}}র কার্ড/ফিঙ্গারপ্রিন্ট সংযুক্ত করা হয়েছে", en: "{{student}} card/fingerprint assigned" },

  // Library
  { key: "library/categories|CREATE", bn: "লাইব্রেরি ক্যাটাগরি যোগ করা হয়েছে", en: "Library category added" },
  { key: "library/categories|UPDATE", bn: "লাইব্রেরি ক্যাটাগরি হালনাগাদ করা হয়েছে", en: "Library category updated" },
  { key: "library/categories|DELETE", bn: "লাইব্রেরি ক্যাটাগরি মুছে ফেলা হয়েছে", en: "Library category deleted" },
  { key: "library/books|CREATE", bn: "লাইব্রেরিতে বই যোগ করা হয়েছে", en: "Library book added" },
  { key: "library/books|UPDATE", bn: "বইয়ের তথ্য হালনাগাদ করা হয়েছে", en: "Library book updated" },
  { key: "library/books|DELETE", bn: "বই মুছে ফেলা হয়েছে", en: "Library book deleted" },
  { key: "library/borrow-records|CREATE", bn: "বই ইস্যু করা হয়েছে", en: "Book issued" },
  { key: "library/borrow-records/return|CREATE", bn: "বই ফেরত নেওয়া হয়েছে", en: "Book returned" },
  { key: "library/borrow-records/mark-lost|CREATE", bn: "বই হারানো হিসেবে চিহ্নিত করা হয়েছে", en: "Book marked as lost" },
  { key: "library/borrow-records/settle-fine|CREATE", bn: "লাইব্রেরির জরিমানা পরিশোধ করা হয়েছে", en: "Library fine settled" },
  { key: "library/settings/fine-per-day|CREATE", bn: "লাইব্রেরির প্রতিদিনের জরিমানার হার নির্ধারণ করা হয়েছে", en: "Library fine-per-day rate set" },

  // Settings
  { key: "settings/branding|UPDATE", bn: "ব্র্যান্ডিং সেটিংস হালনাগাদ করা হয়েছে", en: "Branding settings updated" },
  { key: "settings/branding/logo|DELETE", bn: "লোগো মুছে ফেলা হয়েছে", en: "Logo removed" },
  { key: "settings/branding/banner|DELETE", bn: "ব্যানার মুছে ফেলা হয়েছে", en: "Banner removed" },
  { key: "settings/branding/watermark|DELETE", bn: "ওয়াটারমার্ক মুছে ফেলা হয়েছে", en: "Watermark removed" },
  { key: "settings/document-templates|UPDATE", bn: "ডকুমেন্ট টেমপ্লেট সেটিংস হালনাগাদ করা হয়েছে", en: "Document template settings updated" },
  { key: "settings/id-card-design|UPDATE", bn: "আইডি কার্ডের ডিজাইন হালনাগাদ করা হয়েছে", en: "ID card design updated" },
  { key: "settings/admit-card-design|UPDATE", bn: "এডমিট কার্ডের ডিজাইন হালনাগাদ করা হয়েছে", en: "Admit card design updated" },
  { key: "settings/letter-design|UPDATE", bn: "চিঠির ডিজাইন হালনাগাদ করা হয়েছে", en: "Letter design updated" },
  { key: "settings/book-label-design|UPDATE", bn: "বই-লেবেলের ডিজাইন হালনাগাদ করা হয়েছে", en: "Book label design updated" },

  // Public website
  { key: "website/admin/settings|UPDATE", bn: "ওয়েবসাইট সেটিংস হালনাগাদ করা হয়েছে", en: "Website settings updated" },
  { key: "website/admin/pages|UPDATE", bn: "ওয়েবসাইট পেজ হালনাগাদ করা হয়েছে", en: "Website page updated" },
  { key: "website/admin/notices|CREATE", bn: "ওয়েবসাইট নোটিশ যোগ করা হয়েছে", en: "Website notice added" },
  { key: "website/admin/notices|DELETE", bn: "ওয়েবসাইট নোটিশ মুছে ফেলা হয়েছে", en: "Website notice deleted" },
  { key: "website/admin/gallery|CREATE", bn: "গ্যালারিতে ছবি যোগ করা হয়েছে", en: "Gallery photo added" },
  { key: "website/admin/gallery|DELETE", bn: "গ্যালারি থেকে ছবি মুছে ফেলা হয়েছে", en: "Gallery photo deleted" },
  { key: "website/admin/slides|CREATE", bn: "হিরো স্লাইড যোগ করা হয়েছে", en: "Hero slide added" },
  { key: "website/admin/slides|DELETE", bn: "হিরো স্লাইড মুছে ফেলা হয়েছে", en: "Hero slide deleted" },
  { key: "website/admin/committee|CREATE", bn: "কমিটির সদস্য যোগ করা হয়েছে", en: "Committee member added" },
  { key: "website/admin/committee|DELETE", bn: "কমিটির সদস্য মুছে ফেলা হয়েছে", en: "Committee member deleted" },
  { key: "website/admin/admissions/status|UPDATE", bn: "ভর্তি আবেদনের অবস্থা পরিবর্তন করা হয়েছে", en: "Admission application status changed" },
  { key: "website/admin/admissions|DELETE", bn: "ভর্তি আবেদন মুছে ফেলা হয়েছে", en: "Admission application deleted" },

  // Document templates (custom action strings, not plain CREATE/UPDATE/DELETE)
  { key: "documenttemplate|DOCUMENT_TEMPLATE.CREATE", bn: "ডকুমেন্ট টেমপ্লেট তৈরি করা হয়েছে", en: "Document template created" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.CLONE", bn: "ডকুমেন্ট টেমপ্লেট কপি (ক্লোন) করা হয়েছে", en: "Document template cloned" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.PUBLISH", bn: "ডকুমেন্ট টেমপ্লেট প্রকাশ করা হয়েছে", en: "Document template published" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.UPDATE", bn: "ডকুমেন্ট টেমপ্লেট হালনাগাদ করা হয়েছে", en: "Document template updated" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.DELETE", bn: "ডকুমেন্ট টেমপ্লেট মুছে ফেলা হয়েছে", en: "Document template deleted" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.SET_SYSTEM_DEFAULT", bn: "সিস্টেম ডিফল্ট টেমপ্লেট নির্ধারণ করা হয়েছে", en: "System default template set" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.SET_TENANT_DEFAULT", bn: "{{institution}}র ডিফল্ট টেমপ্লেট নির্ধারণ করা হয়েছে", en: "{{institution}} default template set" },
  { key: "documenttemplate|DOCUMENT_TEMPLATE.AUTO_MIGRATED", bn: "টেমপ্লেট স্বয়ংক্রিয়ভাবে মাইগ্রেট করা হয়েছে", en: "Template auto-migrated" },

  // Login/logout history (AuthService, see backend auth.activity.ts)
  { key: "security|LOGIN", bn: "লগইন করেছেন", en: "Logged in" },
  { key: "security|LOGIN_FAILED", bn: "লগইনের চেষ্টা ব্যর্থ হয়েছে", en: "Failed login attempt" },
  { key: "security|ACCOUNT_LOCKED", bn: "বারবার ভুল পাসওয়ার্ড — অ্যাকাউন্ট লক করা হয়েছে", en: "Account locked after failed attempts" },
  { key: "security|LOGOUT", bn: "লগআউট করেছেন", en: "Logged out" },
  { key: "security|LOGOUT_DEVICE", bn: "অন্য একটি ডিভাইস লগআউট করেছেন", en: "Logged out another device" },
  { key: "security|LOGOUT_OTHERS", bn: "অন্য সব ডিভাইস লগআউট করেছেন", en: "Logged out all other devices" },
  { key: "security|LOGOUT_ALL", bn: "সব ডিভাইস থেকে লগআউট করেছেন", en: "Logged out from all devices" },

  // Super-admin actions visible in a tenant's own log
  { key: "madrasa|MADRASA_CREATED", bn: "{{institution}} তৈরি করা হয়েছে", en: "{{institution}} created" },
  { key: "madrasa|SUPER_ADMIN_MADRASA_UPDATED", bn: "{{institution}}র তথ্য হালনাগাদ করা হয়েছে (সুপার এডমিন)", en: "{{institution}} updated (super admin)" },
  { key: "madrasa|SUPER_ADMIN_MADRASA_DATA_CLEANED", bn: "{{institution}}র ডেটা ক্লিন করা হয়েছে (সুপার এডমিন)", en: "{{institution}} data cleaned (super admin)" },
  { key: "user|SUPER_ADMIN_USER_CREATED", bn: "নতুন ইউজার তৈরি করা হয়েছে (সুপার এডমিন)", en: "User created (super admin)" },
  { key: "user|SUPER_ADMIN_USER_DELETED", bn: "ইউজার মুছে ফেলা হয়েছে (সুপার এডমিন)", en: "User deleted (super admin)" },
  { key: "user|SUPER_ADMIN_USER_CREDENTIALS_RESET", bn: "ইউজারের লগইন তথ্য হালনাগাদ করা হয়েছে (সুপার এডমিন)", en: "User login details updated (super admin)" },
  { key: "user|SUPER_ADMIN_USER_ROLE_STATUS_UPDATED", bn: "ইউজারের রোল/স্ট্যাটাস পরিবর্তন করা হয়েছে (সুপার এডমিন)", en: "User role/status changed (super admin)" },

  // Per-division fail mark (POST /fail-mark/divisions/:divisionId - the numeric
  // id is stripped by the backend, so the entity is "fail-mark/divisions"; the
  // same call both sets and clears a division's override)
  { key: "fail-mark/divisions|CREATE", bn: "{{division}}ভিত্তিক ফেল মার্ক হালনাগাদ করা হয়েছে", en: "{{division}} fail mark updated" },

  // Talimat
  { key: "talimat/create|CREATE", bn: "{{academic}} যোগ করা হয়েছে", en: "{{academic}} added" },
];

const specialFor = (lang: "bn" | "en") =>
  Object.fromEntries(SPECIAL_LABEL_ROWS.map((row) => [row.key, row[lang]])) as Record<string, string>;

// ---------------------------------------------------------------------------
// Structured (JSON) details. Some backend paths - mostly super-admin and the
// result workflow - log `details` as a JSON object instead of readable text.
// These dictionaries turn that object into "label: value" lines so the log
// never shows raw keys like {"user_id":10,"name_changed":true}.


const DETAIL_LABELS: Record<Lang, Record<string, string>> = {
  bn: {
    name: "নাম",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    slug: "স্লাগ",
    user_id: "ইউজার আইডি",
    user_name: "ইউজার",
    madrasa_name: "{{institution}}",
    role_id: "রোল আইডি",
    is_active: "অবস্থা",
    website_status: "ওয়েবসাইটের অবস্থা",
    plan_id: "প্ল্যান আইডি",
    plan: "প্ল্যান",
    mode: "ধরন",
    superAdminId: "সুপার এডমিন আইডি",
    result_master_id: "ফলাফল আইডি",
    exam_id: "পরীক্ষা আইডি",
    class_id: "{{class}} আইডি",
    book_id: "{{subject}} আইডি",
    student_id: "{{student}} আইডি",
    field: "ঘর",
    old_value: "আগের মান",
    new_value: "নতুন মান",
    reason: "কারণ",
    comment: "মন্তব্য",
    remarks: "মন্তব্য",
    count: "সংখ্যা",
    components: "নম্বর বিভাজন",
    component: "অংশ",
    full_mark: "পূর্ণ নম্বর",
    previous_status: "আগের অবস্থা",
    changed_students: "পরিবর্তিত {{student}}",
    total_students: "মোট {{student}}",
    passCount: "পাস",
    failCount: "ফেল",
    absentCount: "অনুপস্থিত",
    withheldCount: "স্থগিত",
  },
  en: {
    name: "Name",
    email: "Email",
    password: "Password",
    slug: "Slug",
    user_id: "User ID",
    user_name: "User",
    madrasa_name: "{{institution}}",
    role_id: "Role ID",
    is_active: "Status",
    website_status: "Website status",
    plan_id: "Plan ID",
    plan: "Plan",
    mode: "Mode",
    superAdminId: "Super admin ID",
    result_master_id: "Result ID",
    exam_id: "Exam ID",
    class_id: "{{class}} ID",
    book_id: "{{subject}} ID",
    student_id: "{{student}} ID",
    field: "Field",
    old_value: "Old value",
    new_value: "New value",
    reason: "Reason",
    comment: "Comment",
    remarks: "Remarks",
    count: "Count",
    components: "Mark components",
    component: "Component",
    full_mark: "Full mark",
    previous_status: "Previous status",
    changed_students: "{{student}}s changed",
    total_students: "Total {{student}}s",
    passCount: "Passed",
    failCount: "Failed",
    absentCount: "Absent",
    withheldCount: "Withheld",
  },
};

// Known enum-ish string values, looked up case-insensitively.
const DETAIL_VALUES: Record<Lang, Record<string, string>> = {
  bn: {
    active: "সক্রিয়",
    limited: "সীমিত",
    disabled: "বন্ধ",
    operational: "শুধু কার্যক্রমের ডেটা",
    full: "সম্পূর্ণ",
    draft: "খসড়া",
    processed: "প্রসেসকৃত",
    published: "প্রকাশিত",
    locked: "লক করা",
    approved: "অনুমোদিত",
    verified: "যাচাইকৃত",
  },
  en: {
    operational: "Operational data only",
  },
};

const DETAIL_TEXT: Record<Lang, { yes: string; no: string; active: string; inactive: string; changed: string }> = {
  bn: { yes: "হ্যাঁ", no: "না", active: "সক্রিয়", inactive: "নিষ্ক্রিয়", changed: "পরিবর্তিত" },
  en: { yes: "Yes", no: "No", active: "Active", inactive: "Inactive", changed: "Changed" },
};

type Verbs = Record<string, (noun: string) => string>;

export const activityText = defineText({
  bn: {
    title: "অ্যাক্টিভিটি লগ",
    subtitle: "ওয়েবসাইটে যা কিছু করা হয়েছে তার সম্পূর্ণ ইতিহাস",
    quickRangeLabel: "সময়সীমা",
    categoryLabel: "ধরন",
    categoryAll: "সব কাজ",
    categorySecurity: "শুধু লগইন ও নিরাপত্তা",
    applyLabel: "প্রয়োগ করুন",
    clearLabel: "রিসেট",
    cancelLabel: "বাতিল",
    rangePlaceholder: "নির্দিষ্ট তারিখ বাছাই",
    presetToday: "আজ",
    presetYesterday: "গতকাল",
    presetLast7: "গত ৭ দিন",
    presetLast30: "গত ৩০ দিন",
    presetThisMonth: "এই মাস",
    presetLastMonth: "গত মাস",
    prevMonth: "আগের মাস",
    nextMonth: "পরের মাস",
    pickStartHint: "শুরুর ও শেষের তারিখে ক্লিক করুন",
    daysSelected: (n: string) => `${n} দিন`,
    colUser: "ব্যবহারকারী",
    colAction: "কার্যক্রম",
    colEntity: "বিষয়",
    colDetails: "বিস্তারিত",
    colTime: "সময়",
    systemUser: "সিস্টেম",
    superAdminUser: "সুপার এডমিন",
    noDetails: "—",
    empty: "এই সময়সীমায় কোনো অ্যাক্টিভিটি পাওয়া যায়নি",
    loadError: "লগ লোড করা যায়নি",
    totalLabel: (n: string) => `মোট ${n} টি লগ`,
    pageLabel: (page: string, totalPages: string) => `পৃষ্ঠা ${page} / ${totalPages}`,
    prevPage: "পূর্ববর্তী",
    nextPage: "পরবর্তী",
    retentionNote: (days: string) => `${days} দিনের পুরনো লগ স্বয়ংক্রিয়ভাবে মুছে যায়`,
    showMore: (n: string) => `আরও ${n} টি দেখুন`,
    showLess: "কম দেখুন",
    dayOption: (n: string) => `${n} দিন`,
    entities: ENTITY_NOUNS.bn,
    verbs: {
      CREATE: (n) => `${n} যোগ করা হয়েছে`,
      UPDATE: (n) => `${n} হালনাগাদ করা হয়েছে`,
      DELETE: (n) => `${n} মুছে ফেলা হয়েছে`,
    } as Verbs,
    special: specialFor("bn"),
    detailLabels: DETAIL_LABELS.bn,
    detailValues: DETAIL_VALUES.bn,
    detailWords: DETAIL_TEXT.bn,
  },
  en: {
    title: "Activity Log",
    subtitle: "Full history of everything done on the website",
    quickRangeLabel: "Time range",
    categoryLabel: "Type",
    categoryAll: "All activity",
    categorySecurity: "Login & security only",
    applyLabel: "Apply",
    clearLabel: "Reset",
    cancelLabel: "Cancel",
    rangePlaceholder: "Pick dates",
    presetToday: "Today",
    presetYesterday: "Yesterday",
    presetLast7: "Last 7 days",
    presetLast30: "Last 30 days",
    presetThisMonth: "This month",
    presetLastMonth: "Last month",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    pickStartHint: "Click a start and an end date",
    daysSelected: (n) => (n === "1" ? "1 day" : `${n} days`),
    colUser: "User",
    colAction: "Action",
    colEntity: "Entity",
    colDetails: "Details",
    colTime: "Time",
    systemUser: "System",
    superAdminUser: "Super admin",
    noDetails: "—",
    empty: "No activity found in this range",
    loadError: "Failed to load logs",
    totalLabel: (n) => `${n} logs total`,
    pageLabel: (page, totalPages) => `Page ${page} / ${totalPages}`,
    prevPage: "Previous",
    nextPage: "Next",
    retentionNote: (days) => `Logs older than ${days} days are deleted automatically`,
    showMore: (n) => `Show ${n} more`,
    showLess: "Show less",
    dayOption: (n) => `${n} days`,
    entities: ENTITY_NOUNS.en,
    verbs: {
      CREATE: (n) => `${n} created`,
      UPDATE: (n) => `${n} updated`,
      DELETE: (n) => `${n} deleted`,
    },
    special: specialFor("en"),
    detailLabels: DETAIL_LABELS.en,
    detailValues: DETAIL_VALUES.en as Record<string, string>,
    detailWords: DETAIL_TEXT.en,
  },
});

export type ActivityLogText = (typeof activityText)["bn"];

function humanize(value: string): string {
  return value
    .split("/")
    .join(" ")
    .split(/[-_.]/)
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turns a raw {entity, action} activity-log row into a readable sentence in
 * the current UI language. Pass `t` (from useText) inside components. */
export function translateActivityAction(entity: string, action: string, t: ActivityLogText = getText(activityText)): string {
  const normEntity = (entity || "").toLowerCase();
  const normAction = (action || "").toUpperCase();

  const special = t.special[`${normEntity}|${normAction}`];
  if (special) return special;

  const baseEntity = normEntity.split("/")[0];
  const noun = t.entities[baseEntity] ?? humanize(normEntity);
  const verb = t.verbs[normAction] ?? t.verbs.UPDATE;
  return verb(noun);
}

/** Human-readable label for the raw entity string (used for the "Entity" column). */
export function translateEntityName(entity: string, t: ActivityLogText = getText(activityText)): string {
  const normEntity = (entity || "").toLowerCase();
  const baseEntity = normEntity.split("/")[0];
  return t.entities[baseEntity] ?? humanize(normEntity);
}

/** Returns readable lines for a JSON-object `details` string, or null when
 * the text isn't JSON (plain-text details are rendered as they are). */
export function formatJsonDetails(text: string, lang: Lang, t: ActivityLogText = getText(activityText)): string[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const words = t.detailWords;
  const labelOf = (key: string) => t.detailLabels[key] ?? humanize(key);

  const valueOf = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";
    if (key === "is_active") return Number(value) ? words.active : words.inactive;
    if (typeof value === "boolean") return value ? words.yes : words.no;
    if (typeof value === "number") return /_id$|Id$/.test(key) ? localizeDigits(value, lang) : formatNumber(value, lang);
    if (Array.isArray(value)) return value.map((v) => valueOf(key, v)).filter(Boolean).join(", ");
    if (typeof value === "object") {
      // { from, to } = a changed field -> "old → new" (struck-through/green in the table).
      const change = value as { from?: unknown; to?: unknown };
      if ("to" in change) return `${valueOf(key, change.from) || "—"} → ${valueOf(key, change.to) || "—"}`;
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => valueOf(k, v))
        .filter(Boolean)
        .join(" – ");
    }
    const str = String(value);
    return t.detailValues[str.toLowerCase()] ?? str;
  };

  const lines: string[] = [];
  const changed: string[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    // "<field>_changed": true flags collapse into one "Changed: name, email" line.
    const flag = key.match(/^(.+)_changed$/);
    if (flag) {
      if (value) changed.push(labelOf(flag[1]));
      continue;
    }
    const shown = valueOf(key, value);
    if (shown) lines.push(`${labelOf(key)}: ${shown}`);
  }
  if (changed.length) lines.push(`${words.changed}: ${changed.join(", ")}`);
  return lines;
}
