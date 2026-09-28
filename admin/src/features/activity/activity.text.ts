import { defineText, getText } from "@madrasha/shared-ui/src/i18n";

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
  { key: "students/expel|UPDATE", bn: "{{student}}কে বহিষ্কার করা হয়েছে", en: "{{student}} expelled" },
  { key: "students/transfer-session|UPDATE", bn: "{{student}}কে নতুন {{session}}ে স্থানান্তর করা হয়েছে", en: "{{student}} transferred to new {{session}}" },
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

  // Super-admin actions visible in a tenant's own log
  { key: "madrasa|MADRASA_CREATED", bn: "{{institution}} তৈরি করা হয়েছে", en: "{{institution}} created" },
  { key: "madrasa|SUPER_ADMIN_MADRASA_UPDATED", bn: "{{institution}}র তথ্য হালনাগাদ করা হয়েছে (সুপার এডমিন)", en: "{{institution}} updated (super admin)" },
  { key: "madrasa|SUPER_ADMIN_MADRASA_DATA_CLEANED", bn: "{{institution}}র ডেটা ক্লিন করা হয়েছে (সুপার এডমিন)", en: "{{institution}} data cleaned (super admin)" },
  { key: "user|SUPER_ADMIN_USER_CREATED", bn: "নতুন ইউজার তৈরি করা হয়েছে (সুপার এডমিন)", en: "User created (super admin)" },
  { key: "user|SUPER_ADMIN_USER_DELETED", bn: "ইউজার মুছে ফেলা হয়েছে (সুপার এডমিন)", en: "User deleted (super admin)" },

  // Per-division fail mark (POST /fail-mark/divisions/:divisionId - the numeric
  // id is stripped by the backend, so the entity is "fail-mark/divisions"; the
  // same call both sets and clears a division's override)
  { key: "fail-mark/divisions|CREATE", bn: "{{division}}ভিত্তিক ফেল মার্ক হালনাগাদ করা হয়েছে", en: "{{division}} fail mark updated" },

  // Talimat
  { key: "talimat/create|CREATE", bn: "{{academic}} যোগ করা হয়েছে", en: "{{academic}} added" },
];

const specialFor = (lang: "bn" | "en") =>
  Object.fromEntries(SPECIAL_LABEL_ROWS.map((row) => [row.key, row[lang]])) as Record<string, string>;

type Verbs = Record<string, (noun: string) => string>;

export const activityText = defineText({
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
