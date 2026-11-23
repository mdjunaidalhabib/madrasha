export type PlatformActivity = {
  id: number; madrasa_name: string | null; user_name: string | null;
  action: string | null; entity: string | null; entity_id: number | null;
  details: string | null; created_at: string;
};

const nouns: Record<string, string> = {
  super: "প্ল্যাটফর্ম", madrasa: "প্রতিষ্ঠান", madrasas: "প্রতিষ্ঠান", plans: "প্ল্যান", plan: "প্ল্যান",
  user: "ইউজার", users: "ইউজার", admins: "সুপার অ্যাডমিন অ্যাকাউন্ট", roles: "রোল",
  "role-permissions": "রোল ও পারমিশন", divisions: "বিভাগ", classes: "শ্রেণি", books: "বই",
  modules: "মডিউল", "default-fee-structures": "ফি টেমপ্লেট", "important-links": "গুরুত্বপূর্ণ লিংক",
  "vendor-promo": "প্রচার সেটিংস", services: "সেবা", "document-templates": "ডকুমেন্ট টেমপ্লেট",
  documenttemplate: "ডকুমেন্ট টেমপ্লেট", "platform-settings": "প্ল্যাটফর্ম সেটিংস", storage: "স্টোরেজ",
  sms: "এসএমএস", email: "ইমেইল", logo: "লোগো", leads: "লিড", "message-billing": "বার্তা বিলিং",
  packages: "প্যাকেজ", pricing: "মূল্য নির্ধারণ", "purchase-requests": "ক্রয় অনুরোধ",
  subscriptions: "সাবস্ক্রিপশন", "domain-subscriptions": "ডোমেইন সাবস্ক্রিপশন", website: "ওয়েবসাইট",
  websites: "ওয়েবসাইট", "website-control": "ওয়েবসাইট নিয়ন্ত্রণ", auth: "অ্যাকাউন্ট", login: "লগইন",
  templates: "টেমপ্লেট", template: "টেমপ্লেট", config: "সেটিংস", settings: "সেটিংস",
  "default-template": "ডিফল্ট ওয়েবসাইট টেমপ্লেট", image: "ছবি", donations: "অনুদান",
  theme: "থিম", balance: "ব্যালেন্স", status: "অবস্থা",
};
const operations: Record<string, string> = {
  activate: "সক্রিয় করেছেন", reactivate: "পুনরায় সক্রিয় করেছেন", deactivate: "নিষ্ক্রিয় করেছেন",
  suspend: "স্থগিত করেছেন", restore: "ট্র্যাশ থেকে ফিরিয়েছেন", permanent: "স্থায়ীভাবে মুছেছেন",
  clean: "ডেটা ক্লিন করেছেন", "assign-plan": "প্ল্যান নির্ধারণ করেছেন", renew: "মেয়াদ নবায়ন করেছেন",
  "cancel-refund": "বাতিল করে টাকা ফেরত দিয়েছেন", credentials: "লগইন তথ্য পরিবর্তন করেছেন",
  "role-status": "রোল ও সক্রিয়তা পরিবর্তন করেছেন", reorder: "ক্রম পরিবর্তন করেছেন", toggle: "সক্রিয়তা পরিবর্তন করেছেন",
  draft: "খসড়া সংরক্ষণ করেছেন", publish: "প্রকাশ করেছেন", "set-system-default": "ডিফল্ট নির্ধারণ করেছেন",
  "upload-background": "পটভূমির ছবি আপলোড করেছেন", preview: "প্রিভিউ করেছেন", test: "সংযোগ পরীক্ষা করেছেন",
  approve: "অনুমোদন করেছেন", reject: "বাতিল করেছেন", "manual-credit": "ক্রেডিট সমন্বয় করেছেন", login: "লগইন করেছেন",
  reset: "ওয়েবসাইট নতুন করে সাজিয়েছেন", theme: "থিম পরিবর্তন করেছেন", status: "অবস্থা পরিবর্তন করেছেন", balance: "ব্যালেন্স পরীক্ষা করেছেন",
};
const verbs: Record<string, string> = { POST: "তৈরি করেছেন", CREATE: "তৈরি করেছেন", PUT: "হালনাগাদ করেছেন", PATCH: "হালনাগাদ করেছেন", UPDATE: "হালনাগাদ করেছেন", DELETE: "মুছে ফেলেছেন", LOGIN: "লগইন করেছেন", GET: "পরীক্ষা করেছেন" };
const legacyActions: Record<string, string> = {
  MADRASA_CREATED: "প্রতিষ্ঠান তৈরি করেছেন", SUPER_ADMIN_MADRASA_UPDATED: "প্রতিষ্ঠান হালনাগাদ করেছেন",
  SUPER_ADMIN_MADRASA_DATA_CLEANED: "প্রতিষ্ঠানের ডেটা ক্লিন করেছেন", SUPER_ADMIN_DOMAIN_UPDATED: "ডোমেইন পরিবর্তন করেছেন",
  SUPER_ADMIN_SUBSCRIPTION_PURCHASED: "সাবস্ক্রিপশন কিনেছেন", SUPER_ADMIN_SUBSCRIPTION_REFUNDED: "সাবস্ক্রিপশনের টাকা ফেরত দিয়েছেন",
  SUPER_ADMIN_USER_CREATED: "ইউজার তৈরি করেছেন", SUPER_ADMIN_USER_DELETED: "ইউজার মুছে ফেলেছেন",
  SUPER_ADMIN_USER_CREDENTIALS_RESET: "ইউজারের লগইন তথ্য পরিবর্তন করেছেন", SUPER_ADMIN_USER_ROLE_STATUS_UPDATED: "ইউজারের রোল ও সক্রিয়তা পরিবর্তন করেছেন",
  PLAN_CREATED: "প্ল্যান তৈরি করেছেন", PLAN_UPDATED: "প্ল্যান হালনাগাদ করেছেন", PLAN_DELETED: "প্ল্যান মুছে ফেলেছেন",
  PLAN_RESTORED: "প্ল্যান ফিরিয়েছেন", PLAN_PERMANENT_DELETED: "প্ল্যান স্থায়ীভাবে মুছেছেন",
};
const labels: Record<string, string> = {
  name: "নাম", slug: "স্লাগ", email: "ইমেইল", phone: "ফোন", address: "ঠিকানা", user_id: "ইউজার আইডি",
  user_name: "ইউজারের নাম", role_id: "রোল আইডি", is_active: "সক্রিয়", website_status: "ওয়েবসাইটের অবস্থা",
  plan: "প্ল্যান", plan_id: "প্ল্যান আইডি", madrasa_id: "প্রতিষ্ঠানের আইডি", amount: "পরিমাণ", price: "মূল্য",
  from: "আগে", to: "পরে", before: "আগে", after: "পরে", old: "আগে", new: "পরে", mode: "ক্লিনের ধরন",
  sections: "নির্বাচিত অংশ", counts: "রেকর্ডের সংখ্যা", students: "শিক্ষার্থী", teachers: "শিক্ষক", staff: "স্টাফ",
  password_changed: "পাসওয়ার্ড পরিবর্তন", passwordChanged: "পাসওয়ার্ড পরিবর্তন", role: "রোল", status: "অবস্থা",
  start_date: "শুরুর তারিখ", end_date: "শেষ তারিখ", duration_days: "মেয়াদ (দিন)", custom_domain: "কাস্টম ডোমেইন",
  admin_domain: "অ্যাডমিন ডোমেইন", student_limit: "শিক্ষার্থী সীমা", user_limit: "ইউজার সীমা",
  subscription_id: "সাবস্ক্রিপশন আইডি", domain: "ডোমেইন", reason: "কারণ", refund_amount: "ফেরত দেওয়া টাকা",
  retained: "সংরক্ষিত", deleted: "মুছে ফেলা", full: "সম্পূর্ণ", operational: "কার্যক্রমের তথ্য",
  planId: "প্ল্যান আইডি", refundAmount: "ফেরত দেওয়া টাকা", cycle: "সাবস্ক্রিপশনের ধরন", superAdminId: "সুপার অ্যাডমিনের আইডি",
  template_id: "টেমপ্লেট আইডি", name_bn: "বাংলা নাম", name_en: "ইংরেজি নাম",
};
const values: Record<string, string> = {
  active: "সক্রিয়", inactive: "নিষ্ক্রিয়", disabled: "বন্ধ", enabled: "চালু", limited: "সীমিত",
  pending: "অপেক্ষমাণ", approved: "অনুমোদিত", rejected: "বাতিল", contacted: "যোগাযোগ হয়েছে",
  converted: "প্রতিষ্ঠান তৈরি হয়েছে", new: "নতুন", follow_up: "আবার যোগাযোগ করতে হবে", lost: "আগ্রহী নয়",
  SMS: "এসএমএস", EMAIL: "ইমেইল", MADRASA: "মাদ্রাসা", SCHOOL: "স্কুল", COLLEGE: "কলেজ",
  KINDERGARTEN: "কিন্ডারগার্টেন", bn: "বাংলা", en: "ইংরেজি", ar: "আরবি", full: "সম্পূর্ণ", operational: "কার্যক্রমের তথ্য",
  NEW: "নতুন", CONTACTED: "যোগাযোগ হয়েছে", DEMO_SCHEDULED: "ডেমো নির্ধারিত", CONVERTED: "প্রতিষ্ঠান তৈরি হয়েছে", LOST: "আগ্রহী নয়",
  students: "শিক্ষার্থী", fees: "ফি", accounts: "হিসাব", exams: "পরীক্ষা", attendance: "হাজিরা",
  personnel: "শিক্ষক ও স্টাফ", library: "লাইব্রেরি", routines: "রুটিন", logs: "লগ", FIRST: "প্রথম ক্রয়", RENEWAL: "নবায়ন",
  ID_CARD: "পরিচয়পত্র", ADMIT_CARD: "প্রবেশপত্র", CERTIFICATE: "সনদ", CLEARANCE_CERTIFICATE: "ছাড়পত্র",
  TESTIMONIAL: "প্রশংসাপত্র", MARKSHEET: "নম্বরপত্র", FEE_RECEIPT: "ফি রসিদ", SALARY_SLIP: "বেতন রসিদ", BOOK_LABEL: "বইয়ের লেবেল",
};
export const bnNumber = (value: number) => new Intl.NumberFormat("bn-BD", { useGrouping: false }).format(value);
const parse = (value: string | null): unknown => { try { return JSON.parse(value ?? "null"); } catch { return value; } };
type Audit = { version: number; method: string; input?: Record<string, unknown>; before?: Record<string, unknown>; after?: Record<string, unknown>; outcome?: Record<string, unknown>; events?: { action: string; entity: string; details: string | null }[]; summary?: string };
function audit(row: PlatformActivity): Audit | null {
  const value = parse(row.details);
  return row.action === "SUPER_ADMIN_AUDIT" && value && typeof value === "object" && "version" in value ? value as Audit : null;
}
export function activityEntity(row: PlatformActivity): string {
  const parts = (row.entity ?? "").toLowerCase().split("/").filter((part) => part && part !== "super");
  const names = parts.filter((part) => !operations[part]).map((part) => nouns[part] ?? "সংশ্লিষ্ট তথ্য");
  return [...new Set(names)].join(" / ") || "প্ল্যাটফর্ম";
}
export function activityAction(row: PlatformActivity): string {
  if (legacyActions[row.action ?? ""]) return legacyActions[row.action!];
  const data = audit(row);
  const segments = row.entity?.split("/") ?? [];
  const last = segments[segments.length - 1] ?? "";
  if (operations[last]) return operations[last];
  if (data?.method === "DELETE" && ["super/madrasas", "super/plans"].includes(row.entity ?? "")) return "ট্র্যাশে সরিয়েছেন";
  if (data) return verbs[data.method] ?? "কাজ সম্পন্ন করেছেন";
  const code = (row.action ?? "").toUpperCase();
  if (/PUBLISH/.test(code)) return "প্রকাশ করেছেন";
  if (/RESTORE/.test(code)) return "ট্র্যাশ থেকে ফিরিয়েছেন";
  if (/DELETE/.test(code)) return "মুছে ফেলেছেন";
  if (/CREATE/.test(code)) return "তৈরি করেছেন";
  if (/UPDATE|SAVE/.test(code)) return "হালনাগাদ করেছেন";
  if (/TOGGLE/.test(code)) return "সক্রিয়তা পরিবর্তন করেছেন";
  if (/DEFAULT/.test(code)) return "ডিফল্ট নির্ধারণ করেছেন";
  return verbs[code] ?? "কাজ সম্পন্ন করেছেন";
}
function display(value: unknown, depth = 0): string {
  if (value == null) return "নেই";
  if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
  if (typeof value === "number") return bnNumber(value);
  if (typeof value === "string") {
    if (values[value]) return values[value];
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(new Date(value).getTime()))
      return new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    return value.replace(/\b(ID_CARD|ADMIT_CARD|CERTIFICATE|CLEARANCE_CERTIFICATE|TESTIMONIAL|MARKSHEET|FEE_RECEIPT|SALARY_SLIP|BOOK_LABEL)\b/g, (code) => values[code]);
  }
  if (depth > 5) return "বিস্তারিত তথ্য";
  if (Array.isArray(value)) return value.map((entry) => display(entry, depth + 1)).join("; ") || "নেই";
  return Object.entries(value as Record<string, unknown>).filter(([key]) => !/password|secret|token|api.?key/i.test(key) || /changed/i.test(key))
    .map(([key, item]) => `${labels[key] ?? (/^[\x00-\x7f]+$/.test(key) ? nouns[key] ?? "অতিরিক্ত তথ্য" : key)}: ${display(item, depth + 1)}`).join("\n");
}
export function activityDetails(row: PlatformActivity): string {
  const data = audit(row);
  if (!data) return display(parse(row.details));
  const lines: string[] = [];
  if (data.method === "LOGIN") lines.push("সুপার অ্যাডমিন প্যানেলে লগইন করেছেন");
  const before = data.before ?? {}, after = data.after ?? {};
  if (Object.keys(before).length && Object.keys(after).length) {
    const changes = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    for (const key of changes) lines.push(`${key}: ${display(before[key])} → ${display(after[key])}`);
    if (!changes.length) lines.push("রেকর্ডের মূল তথ্য অপরিবর্তিত আছে");
  } else if (Object.keys(before).length) lines.push(`সংশ্লিষ্ট রেকর্ড:\n${display(before)}`);
  else if (Object.keys(after).length) lines.push(`সংরক্ষিত তথ্য:\n${display(after)}`);
  if (data.input && Object.keys(data.input).length) lines.push(`অনুরোধের তথ্য:\n${display(data.input)}`);
  if (data.outcome && Object.keys(data.outcome).length) lines.push(`ফলাফল:\n${display(data.outcome)}`);
  for (const event of data.events ?? []) {
    if (event.details) lines.push(`বিস্তারিত কার্যক্রম:\n${display(parse(event.details))}`);
  }
  if (!lines.length) lines.push("কাজটি সফলভাবে সম্পন্ন হয়েছে");
  return lines.join("\n\n");
}
