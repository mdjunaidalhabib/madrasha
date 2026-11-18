import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { prismaMock, log } = vi.hoisted(() => ({
  prismaMock: {
    websiteNotice: { findFirst: vi.fn() },
    websiteGallery: { findFirst: vi.fn() },
    websiteDonationSettings: { findUnique: vi.fn() },
    websiteSettings: { findUnique: vi.fn() },
    madrasa: { findUnique: vi.fn() },
  },
  log: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: log }));
import { websiteActivityMiddleware, websiteSnapshot } from "../website-activity.middleware";
import { activityLoggerMiddleware } from "../../../shared/middleware/activityLogger.middleware";

beforeEach(() => { vi.clearAllMocks(); });

async function request(method: string, path: string, body = {}, statusCode = 200, response = {}) {
  const req = { method, path, originalUrl: `/api/website${path}`, body, tenant: { madrasa_id: 42 }, user: { id: 7 } } as any;
  const res = Object.assign(new EventEmitter(), { locals: {} as any, statusCode, json: vi.fn() }) as any;
  const next = vi.fn();
  // Exercise the production listener ordering to guard against duplicate rows.
  activityLoggerMiddleware(req, res, next);
  await websiteActivityMiddleware(req, res, next);
  res.json(response);
  res.emit("finish");
  await new Promise((resolve) => setTimeout(resolve, 0));
  return res;
}

describe("website audit trail", () => {
  it("records POST edits as updates with a tenant-scoped before/after diff exactly once", async () => {
    prismaMock.websiteNotice.findFirst.mockResolvedValueOnce({ title: "পুরোনো", isPublished: 1 })
      .mockResolvedValueOnce({ title: "নতুন", isPublished: 0 });
    await request("POST", "/admin/notices", { id: 8 });
    expect(prismaMock.websiteNotice.findFirst).toHaveBeenNthCalledWith(1, { where: { madrasaId: 42, id: 8 } });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      madrasa_id: 42, user_id: 7, action: "UPDATE", entity_id: 8,
      details: expect.stringContaining("শিরোনাম: পুরোনো → নতুন"),
    }));
    expect(log.mock.calls[0][0].details).toContain("প্রকাশিত: চালু → বন্ধ");
  });

  it("uses the created response id to describe the actual new record", async () => {
    prismaMock.websiteNotice.findFirst.mockResolvedValue({ title: "নতুন নোটিশ", content: "ছুটি" });
    await request("POST", "/admin/notices", {}, 200, { data: { id: 9 } });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE", entity_id: 9, details: expect.stringContaining("নতুন নোটিশ") }));
    expect(prismaMock.websiteNotice.findFirst).toHaveBeenCalledWith({ where: { madrasaId: 42, id: 9 } });
  });

  it("retains deleted record names and puts the warning directly below the headline", async () => {
    prismaMock.websiteGallery.findFirst.mockResolvedValue({ title: "বার্ষিক অনুষ্ঠান", imageUrl: "/image.jpg" });
    await request("DELETE", "/admin/gallery/12");
    expect(log).toHaveBeenCalledTimes(1);
    const entry = log.mock.calls[0][0];
    expect(entry.action).toBe("DELETE");
    expect(entry.details).toContain("বার্ষিক অনুষ্ঠান");
    expect(entry.details.split("\n")[1]).toContain("স্থায়ীভাবে মুছে");
  });

  it("does not record failed mutations", async () => {
    prismaMock.websiteNotice.findFirst.mockResolvedValue(null);
    await request("POST", "/admin/notices", { id: 999 }, 404);
    expect(log).not.toHaveBeenCalled();
  });

  it("never copies reset passwords or spoofed actor/tenant ids", async () => {
    await request("POST", "/admin/reset", { password: "private-secret", madrasa_id: 99, user_id: 123 });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ madrasa_id: 42, user_id: 7, action: "UPDATE" }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-secret");
    expect(log.mock.calls[0][0].details).toContain("মূল ডেমোতে রিসেট");
  });

  it("allows only named display fields in snapshots", () => {
    const snapshot = websiteSnapshot(42, "notices", { title: "নোটিশ", password: "secret", token: "secret", unknown: "secret" });
    expect(snapshot?.fields).toEqual({ শিরোনাম: "নোটিশ" });
  });

  it("records persisted website settings and institution contact changes", async () => {
    prismaMock.websiteSettings.findUnique.mockResolvedValueOnce({ themeKey: "modern", showGallery: 1 })
      .mockResolvedValueOnce({ themeKey: "classic", showGallery: 0 });
    prismaMock.madrasa.findUnique.mockResolvedValueOnce({ name: "প্রতিষ্ঠান", phone: "111" })
      .mockResolvedValueOnce({ name: "প্রতিষ্ঠান", phone: "222" });
    await request("PUT", "/admin/settings", { phone: "unpersisted-input" });
    const details = log.mock.calls[0][0].details;
    expect(details).toContain("থিম: modern → classic");
    expect(details).toContain("গ্যালারি দেখানো: চালু → বন্ধ");
    expect(details).toContain("ফোন: 111 → 222");
    expect(details).not.toContain("unpersisted-input");
  });

  it("describes donation changes by field without dumping unknown configuration keys", async () => {
    prismaMock.websiteDonationSettings.findUnique.mockResolvedValueOnce({ config: { published: false, methods: [] } })
      .mockResolvedValueOnce({ config: { published: true, password: "secret", methods: [{ type: "bkash", accountName: "প্রতিষ্ঠান", accountNumber: "01700000000", token: "secret" }] } });
    await request("PUT", "/admin/donations");
    const details = log.mock.calls[0][0].details;
    expect(details).toContain("অনুদান প্রকাশিত: বন্ধ → চালু");
    expect(details).toContain("পেমেন্ট মাধ্যম: — → bkash / প্রতিষ্ঠান / 01700000000");
    expect(details).not.toContain("secret");
  });
});
