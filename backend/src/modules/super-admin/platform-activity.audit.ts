import type { Request } from "express";
import { prisma } from "../../shared/database/prisma";
import type { ActivityRequestContext } from "../../shared/utils/activityContext";
import { describeActivityRequest, responseEntityId } from "../../shared/utils/activityRequestDetails";

export const PLATFORM_AUDIT_ACTION = "SUPER_ADMIN_AUDIT";

// Only approved business fields enter the audit trail. Never serialize a full
// request, response or database record: they can contain passwords and API keys.
const fields: Record<string, string> = {
  id: "আসল আইডি", madrasaNo: "প্রতিষ্ঠান নম্বর", name: "নাম", nameBn: "বাংলা নাম", name_bn: "বাংলা নাম",
  nameEn: "ইংরেজি নাম", name_en: "ইংরেজি নাম", title: "শিরোনাম", slug: "স্লাগ", email: "ইমেইল",
  phone: "ফোন", address: "ঠিকানা", isActive: "সক্রিয়", is_active: "সক্রিয়", status: "অবস্থা",
  websiteStatus: "ওয়েবসাইটের অবস্থা", website_status: "ওয়েবসাইটের অবস্থা", institution_type: "প্রতিষ্ঠানের ধরন",
  institutionType: "প্রতিষ্ঠানের ধরন", default_language: "ভাষা", student_limit: "শিক্ষার্থী সীমা",
  studentLimit: "শিক্ষার্থী সীমা", user_limit: "ইউজার সীমা", userLimit: "ইউজার সীমা", plan_id: "প্ল্যান আইডি",
  roleId: "রোল আইডি", role_id: "রোল আইডি", customDomain: "কাস্টম ডোমেইন", custom_domain: "কাস্টম ডোমেইন",
  admin_domain: "অ্যাডমিন ডোমেইন", adminDomain: "অ্যাডমিন ডোমেইন", amount: "পরিমাণ", price: "মূল্য",
  durationDays: "মেয়াদ (দিন)", duration_days: "মেয়াদ (দিন)", start_date: "শুরুর তারিখ", end_date: "শেষ তারিখ",
  reason: "কারণ", note: "মন্তব্য", notes: "মন্তব্য", review_note: "পর্যালোচনার মন্তব্য",
  channel: "মাধ্যম", quantity: "পরিমাণ", credits: "ক্রেডিট", credit: "ক্রেডিট", unit_price: "একক মূল্য",
  sortOrder: "ক্রম", sort_order: "ক্রম", url: "লিংক", type: "ধরন", mode: "ক্লিনের ধরন",
  enabled: "চালু", deletedAt: "ট্র্যাশে পাঠানোর সময়", next_follow_up_at: "পরবর্তী যোগাযোগের সময়",
  sections: "নির্বাচিত অংশ", modules: "মডিউল", divisions: "বিভাগ", classes: "শ্রেণি", books: "বই",
  permission_ids: "পারমিশন", permissions: "পারমিশন", ids: "নির্বাচিত রেকর্ড", items: "এন্ট্রি",
  default_users: "প্রাথমিক ইউজার", users: "ইউজার", limits: "সীমা", config: "কনফিগারেশন",
  institution: "প্রতিষ্ঠান", studentCount: "শিক্ষার্থী সংখ্যা", followUpAt: "পরবর্তী যোগাযোগের সময়",
  custom_amount: "নির্ধারিত মূল্য", payment_method: "পরিশোধের মাধ্যম", transaction_id: "লেনদেন নম্বর",
  theme: "থিম", template: "টেমপ্লেট", template_id: "টেমপ্লেট আইডি", access: "প্রবেশাধিকার", can_receive_donations: "অনুদান গ্রহণের অনুমতি",
  donation_enabled: "অনুদান চালু", is_enabled: "চালু", channel_type: "বার্তার মাধ্যম", unitPrice: "একক মূল্য",
  rate: "দর", validity_days: "মেয়াদ (দিন)", balance: "ব্যালেন্স", adjustment: "সমন্বয়", description: "বিবরণ",
  reg_block_sizes: "রেজিস্ট্রেশন নম্বরের বরাদ্দ", validityDays: "মেয়াদ (দিন)",
  label: "নাম", subLabel: "সহায়ক লেখা", sub_label: "সহায়ক লেখা", frequency: "ফির পুনরাবৃত্তি", feeType: "ফির ধরন",
  fee_type: "ফির ধরন", classId: "শ্রেণির আইডি", class_id: "শ্রেণির আইডি", provider: "সেবাদাতা",
  host: "সার্ভারের ঠিকানা", port: "পোর্ট", secure: "নিরাপদ সংযোগ", from_email: "প্রেরকের ইমেইল",
  from_name: "প্রেরকের নাম", sender_id: "প্রেরকের আইডি", senderId: "প্রেরকের আইডি",
  theme_key: "থিম", allowed: "অনুমোদিত", success: "সফল", connected: "সংযুক্ত", configured: "কনফিগার করা আছে",
  ok: "সফল", count: "রেকর্ডের সংখ্যা", created: "তৈরি হয়েছে", updated: "হালনাগাদ হয়েছে", deleted: "মুছে ফেলা হয়েছে",
};

export function safePlatformFields(value: unknown, depth = 0): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return {};
  const result: Record<string, unknown> = {};
  for (const [key, label] of Object.entries(fields)) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    if (item === null || typeof item === "boolean" || typeof item === "number") result[label] = item;
    else if (item instanceof Date) result[label] = item.toISOString();
    else if (typeof item === "object" && "toNumber" in item && typeof item.toNumber === "function") result[label] = item.toNumber();
    else if (typeof item === "string" && !/^(data:|Bearer\s)/i.test(item)) result[label] = item.slice(0, 1000);
    else if (Array.isArray(item)) {
      result[label] = item.slice(0, 100).map((entry) => typeof entry === "object" && entry !== null
        ? safePlatformFields(entry, depth + 1)
        : typeof entry === "number" || typeof entry === "boolean" ? entry : String(entry).slice(0, 200));
      if (item.length > 100) result[`${label} — মোট`] = item.length;
    } else if (typeof item === "object") result[label] = safePlatformFields(item, depth + 1);
  }
  // Record the fact of a credential change, never the credential itself.
  if (Object.keys(value).some((key) => /password/i.test(key))) result["পাসওয়ার্ড দেওয়া হয়েছে"] = true;
  if (Object.keys(value).some((key) => /secret|token|api.?key/i.test(key))) result["গোপন কনফিগারেশন পরিবর্তনের অনুরোধ"] = true;
  if (Object.keys(value).some((key) => /^(design|content|html|layout|draft|sections_json|config_json)$/i.test(key))) result["ডিজাইন বা বিষয়বস্তু পরিবর্তনের অনুরোধ"] = true;
  if (Object.keys(value).some((key) => /^(image|image_data|imageData|logo|background|data_url|dataUrl)$/i.test(key))) result["ছবি পরিবর্তনের অনুরোধ"] = true;
  return result;
}

function target(path: string): { entity: string; id: number | null; madrasaId: number | null } {
  const parts = path.split("?")[0].replace(/^\/api\//, "").replace(/^website\/super\//, "super/website/").split("/").filter(Boolean);
  const numbers = parts.filter((part) => /^\d+$/.test(part));
  const mi = parts.indexOf("madrasas");
  const subresource = mi >= 0 && ["users", "role-permissions", "subscriptions", "domain-subscriptions"].includes(parts[mi + 2]);
  return { entity: parts.filter((part) => !/^\d+$/.test(part)).join("/"),
    id: numbers.length && (!subresource || numbers.length > 1) ? Number(numbers[numbers.length - 1]) : null,
    madrasaId: mi >= 0 && /^\d+$/.test(parts[mi + 1] ?? "") ? Number(parts[mi + 1]) : null };
}

async function snapshot(path: string, id: number | null) {
  if (!id) return null;
  const entity = target(path).entity.replace(/^super\/website\//, "super/");
  if (/^super\/madrasas\/(users|role-permissions)/.test(entity)) {
    if (entity.includes("/users")) return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, roleId: true, isActive: true } });
    return prisma.role.findUnique({ where: { id }, select: { id: true, nameBn: true } });
  }
  if (/^super\/madrasas(?:\/(activate|suspend|restore|permanent|clean|assign-plan|renew|status|theme|reset|donations))?$/.test(entity)) {
    return prisma.madrasa.findUnique({ where: { id }, select: { id: true, madrasaNo: true, name: true, slug: true, isActive: true, deletedAt: true, websiteStatus: true, customDomain: true, adminDomain: true, studentLimit: true, userLimit: true } });
  }
  if (/^super\/plans(?:\/(toggle|restore|permanent))?$/.test(entity)) return prisma.plan.findUnique({ where: { id }, select: { id: true, name: true, price: true, isActive: true, deletedAt: true } });
  if (/^super\/admins/.test(entity)) return prisma.superAdmin.findUnique({ where: { id }, select: { id: true, name: true, email: true, isActive: true } });
  if (entity === "super/leads") return prisma.platformLead.findUnique({ where: { id }, select: { id: true, name: true, status: true, notes: true, followUpAt: true } });
  if (entity === "super/divisions") return prisma.division.findUnique({ where: { id }, select: { id: true, nameBn: true, sortOrder: true } });
  if (/^super\/classes(?:\/toggle)?$/.test(entity)) return prisma.class.findUnique({ where: { id }, select: { id: true, nameBn: true, isActive: true, sortOrder: true } });
  if (entity === "super/books") return prisma.book.findUnique({ where: { id }, select: { id: true, nameBn: true, sortOrder: true } });
  if (entity === "super/important-links") return prisma.importantLink.findUnique({ where: { id }, select: { id: true, label: true, subLabel: true, url: true, isActive: true, sortOrder: true } });
  if (entity === "super/default-fee-structures") return prisma.defaultFeeStructure.findUnique({ where: { id }, select: { id: true, name: true, amount: true, frequency: true, feeType: true, isActive: true } });
  if (/^super\/message-billing\/packages(?:\/toggle)?$/.test(entity)) return prisma.messagePackage.findUnique({ where: { id }, select: { id: true, name: true, channel: true, price: true, credit: true, validityDays: true, isActive: true } });
  return null;
}

export function preparePlatformAudit(req: Request, context: ActivityRequestContext) {
  const info = target(req.originalUrl);
  const before = snapshot(req.originalUrl, info.id).catch(() => null);
  const institution = info.madrasaId ? prisma.madrasa.findUnique({ where: { id: info.madrasaId }, select: { id: true, name: true } }).catch(() => null) : Promise.resolve(null);
  const input = safePlatformFields(req.body);
  return {
    ready: Promise.all([before, institution]),
    async finish(response: unknown) {
      if (req.user?.role !== "super_admin" || !req.user.id) return;
      const root = response && typeof response === "object" ? response as Record<string, unknown> : {};
      const outcome = safePlatformFields(root.data && typeof root.data === "object" ? root.data : root);
      const id = info.id ?? responseEntityId(response) ?? (typeof root.madrasa_id === "number" ? root.madrasa_id : null);
      const [old, madrasa, actor, after] = await Promise.all([
        before, institution,
        prisma.superAdmin.findUnique({ where: { id: req.user.id }, select: { name: true } }),
        req.method === "DELETE" ? Promise.resolve(null) : snapshot(req.originalUrl, id).catch(() => null),
      ]);
      const sourceIds = context.logged.flatMap((entry) => entry.id ? [entry.id] : []);
      const events = sourceIds.length ? await prisma.activityLog.findMany({ where: { id: { in: sourceIds } }, select: { action: true, entity: true, details: true } }) : [];
      await prisma.activityLog.create({ data: {
        // Platform history must survive hard deletion of the institution.
        madrasaId: null, userId: req.user.id, action: PLATFORM_AUDIT_ACTION,
        entity: info.entity.slice(0, 100), entityId: id,
        details: JSON.stringify({ version: 1, method: req.method, actor_name: actor?.name ?? "সুপার অ্যাডমিন",
          madrasa_name: madrasa?.name ?? (info.entity === "super/madrasas" && typeof root.madrasa_id === "number" ? req.body?.name : null),
          madrasa_id: madrasa?.id ?? (typeof root.madrasa_id === "number" ? root.madrasa_id : null),
          input, before: old ? safePlatformFields(old) : null, after: after ? safePlatformFields(after) : null,
          summary: describeActivityRequest({}, response, id), outcome, events, source_log_ids: sourceIds }),
      } });
    },
  };
}
