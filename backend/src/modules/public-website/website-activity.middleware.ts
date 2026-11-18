import { RequestHandler } from "express";
import { prisma } from "../../shared/database/prisma";
import { logger } from "../../shared/logger/logger";
import { logActivity } from "../../shared/utils/activity.util";
import { ActivitySnapshot, buildSnapshotDetails } from "../../shared/utils/activityDetails";

const labels: Record<string, string> = {
  name: "নাম", phone: "ফোন", email: "ইমেইল", address: "ঠিকানা",
  title: "শিরোনাম", content: "বিবরণ", pageKey: "পেজ", studentName: "শিক্ষার্থীর নাম",
  designation: "পদবি", status: "অবস্থা", isPublished: "প্রকাশিত", sortOrder: "ক্রম",
  imageUrl: "ছবি", videoUrl: "ভিডিও লিংক", photoUrl: "ছবি", buttonLink: "বাটনের লিংক",
  publishedAt: "প্রকাশের তারিখ", classApplied: "আবেদনের শ্রেণি", note: "মন্তব্য",
  logoUrl: "লোগো", heroTitle: "মূল শিরোনাম", heroSubtitle: "উপশিরোনাম",
  themeKey: "থিম", themeColor: "থিমের রং", noticeBarText: "নোটিশ বারের লেখা",
  noticeBarSpeed: "নোটিশ বারের গতি", muhtamimName: "মুহতামিমের নাম",
  muhtamimDesignation: "মুহতামিমের পদবি", muhtamimPhoto: "মুহতামিমের ছবি", muhtamimMessage: "মুহতামিমের বাণী",
  sovapotiName: "সভাপতির নাম", sovapotiDesignation: "সভাপতির পদবি", sovapotiPhoto: "সভাপতির ছবি", sovapotiMessage: "সভাপতির বাণী",
  facebookUrl: "ফেসবুক", youtubeUrl: "ইউটিউব", instagramUrl: "ইনস্টাগ্রাম",
  whatsappChannelUrl: "হোয়াটসঅ্যাপ", socialLinks: "সোশ্যাল লিংক", mapUrl: "মানচিত্র",
  published: "অনুদান প্রকাশিত", description: "বিবরণ", instructions: "অনুদানের নির্দেশনা",
  contactPhone: "যোগাযোগের ফোন", checkoutUrl: "পেমেন্ট লিংক",
};
const sections: Record<string, string> = {
  settings: "সেটিংস", pages: "পেজ", notices: "নোটিশ", gallery: "গ্যালারি",
  slides: "স্লাইড", videos: "ভিডিও", committee: "কমিটি সদস্য", admissions: "ভর্তি আবেদন",
  donations: "অনুদান সেটিংস", reset: "রিসেট",
};
Object.entries({ Notices: "নোটিশ", Gallery: "গ্যালারি", Teachers: "শিক্ষক", Admission: "ভর্তি", About: "পরিচিতি", Contact: "যোগাযোগ", Slider: "স্লাইডার", Muhtamim: "মুহতামিম", Committee: "কমিটি", NoticeBar: "নোটিশ বার", Sovapoti: "সভাপতি", VideoGallery: "ভিডিও গ্যালারি" }).forEach(([key, name]) => { labels[`show${key}`] = `${name} দেখানো`; });

// Only known persisted display fields are logged; request bodies and credentials
// (including the reset password) never enter the audit record.
export function websiteSnapshot(madrasaId: number, section: string, row: Record<string, unknown> | null): ActivitySnapshot | null {
  if (!row) return null;
  const fields: Record<string, string> = {};
  for (const [key, label] of Object.entries(labels)) {
    if (!(key in row)) continue;
    const value = row[key];
    const display = value == null || value === "" ? "—"
      : key.startsWith("show") || key === "isPublished" || key === "published" ? (value ? "চালু" : "বন্ধ")
      : value instanceof Date ? value.toISOString()
      : typeof value === "object" ? JSON.stringify(value) : String(value);
    fields[label] = display;
  }
  return { madrasaId, title: `ওয়েবসাইট ${sections[section]}: ${row.title || row.name || row.studentName || row.pageKey || sections[section]}`, fields };
}

async function readSnapshot(madrasaId: number, section: string, id: number | null, pageKey: string): Promise<ActivitySnapshot | null> {
  if (section === "settings") {
    const [settings, institution] = await Promise.all([
      prisma.websiteSettings.findUnique({ where: { madrasaId } }),
      prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { name: true, phone: true, email: true, address: true } }),
    ]);
    return websiteSnapshot(madrasaId, section, { ...settings, ...institution });
  }
  if (section === "pages") return websiteSnapshot(madrasaId, section, await prisma.websitePage.findFirst({ where: { madrasaId, pageKey } }));
  if (section === "donations") {
    const row = await prisma.websiteDonationSettings.findUnique({ where: { madrasaId } });
    const config = row?.config && typeof row.config === "object" && !Array.isArray(row.config) ? row.config as Record<string, unknown> : {};
    const snapshot = websiteSnapshot(madrasaId, section, config)!;
    snapshot.fields["পেমেন্ট মাধ্যম"] = Array.isArray(config.methods)
      ? config.methods.map((method) => {
          if (!method || typeof method !== "object") return "";
          return [method.type, method.accountName, method.accountNumber, method.accountType, method.bankName, method.branchName, method.routingNumber, method.details].filter(Boolean).join(" / ");
        }).filter(Boolean).join("; ") || "—" : "—";
    return snapshot;
  }
  if (!id) return null;
  const where = { madrasaId, id };
  const row = section === "notices" ? await prisma.websiteNotice.findFirst({ where })
    : section === "gallery" ? await prisma.websiteGallery.findFirst({ where })
    : section === "slides" ? await prisma.websiteSlide.findFirst({ where })
    : section === "videos" ? await prisma.websiteVideo.findFirst({ where })
    : section === "committee" ? await prisma.websiteCommitteeMember.findFirst({ where })
    : section === "admissions" ? await prisma.websiteAdmissionApplication.findFirst({ where }) : null;
  return websiteSnapshot(madrasaId, section, row);
}

export const websiteActivityMiddleware: RequestHandler = async (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const madrasaId = req.tenant?.madrasa_id;
  const userId = req.user?.id;
  const segments = req.path.split("/").filter(Boolean);
  const section = segments[1];
  if (!madrasaId || !userId || !sections[section]) return next();
  const rawId = segments[2] || req.body?.id;
  let id = Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const pageKey = String(req.body?.page_key ?? "");
  const read = () => readSnapshot(madrasaId, section, id, pageKey).catch((error) => {
    logger.error("Website activity snapshot failed", error);
    return null;
  });
  const before = section === "reset" ? null : await read();
  res.locals.websiteActivityHandled = true;
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (!id && Number.isSafeInteger(payload?.data?.id)) id = payload.data.id;
    return originalJson(payload);
  };
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    void (async () => {
      const after = req.method === "DELETE" || section === "reset" ? null : await read();
      const action = req.method === "DELETE" ? "DELETE" : section === "reset" ? "UPDATE" : before || req.method !== "POST" || rawId ? "UPDATE" : "CREATE";
      const note = section === "reset" ? "সতর্কতা: ওয়েবসাইটের কনটেন্ট মূল ডেমোতে রিসেট করা হয়েছে"
        : req.method === "DELETE" ? "সতর্কতা: এই তথ্য স্থায়ীভাবে মুছে ফেলা হয়েছে" : null;
      const [headline, ...changes] = (buildSnapshotDetails(before, after) || `ওয়েবসাইট ${sections[section]}`).split("\n");
      const details = [headline, note, ...changes].filter(Boolean).join("\n");
      await logActivity({ madrasa_id: madrasaId, user_id: userId, entity: `website/admin/${section}${section === "admissions" && req.method !== "DELETE" ? "/status" : ""}`, entity_id: id, action, details });
    })().catch((error) => logger.error("Website activity log failed", error));
  });
  next();
};
