import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { EventEmitter } from "node:events";

const mocks = vi.hoisted(() => ({ create: vi.fn(), institution: vi.fn(), actor: vi.fn(), user: vi.fn(), findMany: vi.fn(), query: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {
  activityLog: { create: mocks.create, findMany: mocks.findMany },
  madrasa: { findUnique: mocks.institution }, superAdmin: { findUnique: mocks.actor }, user: { findUnique: mocks.user },
  $queryRaw: mocks.query,
} }));
import { preparePlatformAudit, safePlatformFields } from "../platform-activity.audit";
import { listPlatformActivities } from "../platform-activity.repository";
import { getPlatformActivities } from "../platform-activity.controller";
import { activityLoggerMiddleware } from "../../../shared/middleware/activityLogger.middleware";
import { activityAction, activityDetails, activityEntity, type PlatformActivity } from "../../../../../super-admin/src/features/super-admin/activity/platformActivity";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: 90 });
  mocks.institution.mockImplementation(async ({ select }) => select.madrasaNo ? { id: 34, madrasaNo: 1, name: "আফিয়া", isActive: 1 } : { id: 34, name: "আফিয়া" });
  mocks.actor.mockResolvedValue({ name: "জুনায়েদ" });
  mocks.user.mockResolvedValue({ id: 8, name: "ইউজার" });
  mocks.findMany.mockResolvedValue([]);
});
function req(path: string, method = "PATCH", body: unknown = {}): Request {
  return { originalUrl: `/api/${path}`, method, body, user: { id: 7, role: "super_admin" } } as Request;
}
function row(data: Partial<PlatformActivity> = {}): PlatformActivity {
  return { id: 1, madrasa_name: "আফিয়া", user_name: "জুনায়েদ", created_at: "2026-11-23T08:00:00Z", action: "SUPER_ADMIN_AUDIT", entity: "super/madrasas", entity_id: 34, details: null, ...data };
}

describe("platform audit coverage and safe details", () => {
  it("keeps institution and actor snapshots with no tenant FK after hard deletion", async () => {
    const audit = preparePlatformAudit(req("super/madrasas/34/permanent", "DELETE"), { logged: [] });
    await audit.ready;
    await audit.finish({ message: "deleted" });
    const data = mocks.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ madrasaId: null, userId: 7, action: "SUPER_ADMIN_AUDIT", entityId: 34 });
    expect(JSON.parse(data.details)).toMatchObject({ actor_name: "জুনায়েদ", madrasa_name: "আফিয়া", before: { "আসল আইডি": 34 }, after: null });
    expect(activityAction(row({ entity: data.entity, details: data.details }))).toBe("স্থায়ীভাবে মুছেছেন");
  });
  it("preserves before/after values and embeds existing service events for deduplication", async () => {
    let name = "আগের নাম";
    mocks.institution.mockImplementation(async () => ({ id: 34, name }));
    mocks.findMany.mockResolvedValue([{ action: "SUPER_ADMIN_MADRASA_UPDATED", entity: "madrasa", details: '{"name":{"from":"আগের নাম","to":"নতুন নাম"}}' }]);
    const audit = preparePlatformAudit(req("super/madrasas/34", "PUT", { name: "নতুন নাম" }), { logged: [{ id: 10, madrasaId: 34, userId: null, entity: "madrasa" }] });
    await audit.ready; name = "নতুন নাম"; await audit.finish({});
    const details = mocks.create.mock.calls[0][0].data.details;
    expect(JSON.parse(details).source_log_ids).toEqual([10]);
    expect(activityDetails(row({ details }))).toContain("নাম: আগের নাম → নতুন নাম");
  });
  it("never stores credentials, images or arbitrary nested request contents", () => {
    const result = safePlatformFields({ name: "প্রতিষ্ঠান", password: "private-password", api_key: "private-key", logo: "data:image/private", config: { host: "smtp.example.test", pass: "private-smtp" }, default_users: [{ name: "প্রধান", password: "private-nested" }] });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result).toMatchObject({ "নাম": "প্রতিষ্ঠান", "পাসওয়ার্ড দেওয়া হয়েছে": true, "ছবি পরিবর্তনের অনুরোধ": true });
  });
  it("uses the created user ID, rather than the institution ID, for nested create routes", async () => {
    const audit = preparePlatformAudit(req("super/madrasas/34/users", "POST", { name: "নতুন ইউজার" }), { logged: [] });
    await audit.ready;
    expect(mocks.user).not.toHaveBeenCalled();
    await audit.finish({ data: { id: 8 } });
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 8 } }));
    expect(mocks.create.mock.calls[0][0].data.entityId).toBe(8);
  });
  it("covers website controls mounted outside /super", async () => {
    const audit = preparePlatformAudit(req("website/super/madrasas/34/status", "PATCH", { website_status: "disabled" }), { logged: [] });
    await audit.ready; await audit.finish({});
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.entity).toBe("super/website/madrasas/status");
    expect(JSON.parse(data.details).madrasa_name).toBe("আফিয়া");
  });
  it("does not write an audit for non-super-admin callers", async () => {
    const request = req("super/madrasas/34");
    request.user = { id: 2, role: "MUHTAMIM" } as Request["user"];
    const audit = preparePlatformAudit(request, { logged: [] }); await audit.ready; await audit.finish({});
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("records successful platform requests without tenant context and ignores failures", async () => {
    for (const status of [200, 403]) {
      const request = req("super/madrasas/34/suspend", "POST");
      const response = Object.assign(new EventEmitter(), { statusCode: status, json: vi.fn(), locals: {} }) as unknown as Response;
      await new Promise<void>((resolve) => activityLoggerMiddleware(request, response, () => {
        response.json({}); response.emit("finish"); setImmediate(resolve);
      }));
    }
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});

describe("platform log query and Bangla display", () => {
  it("uses bounded pagination, stable ordering, literal bound search and existing-event deduplication", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 3n }]);
    const result = await listPlatformActivities({ page: 2, limit: 25, search: "%' OR 1=1 --" });
    const sql = mocks.query.mock.calls[0][0];
    expect(sql.sql).toContain("source_log_ids");
    expect(sql.sql).toContain("NOT EXISTS");
    expect(sql.sql).toContain("LEFT JOIN super_admins");
    expect(sql.sql).not.toContain("LEFT JOIN users");
    expect(sql.sql).toContain("ORDER BY created_at DESC, id DESC");
    expect(sql.sql).not.toContain("OR 1=1");
    expect(sql.values).toContain("%' OR 1=1 --");
    expect(result).toMatchObject({ total: 3, page: 2, limit: 25 });
  });
  it("handles inclusive Bangladesh date boundaries and rejects invalid dates", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0n }]);
    const response = { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn();
    await getPlatformActivities({ query: { from: "2026-11-23", to: "2026-11-23", limit: "999999", page: "NaN" } } as unknown as Request, response, next);
    expect(next).not.toHaveBeenCalled();
    const values = mocks.query.mock.calls[0][0].values;
    expect(values).toContainEqual(new Date("2026-11-22T18:00:00Z"));
    expect(values).toContainEqual(new Date("2026-11-23T17:59:59.999Z"));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 100 }));
    await getPlatformActivities({ query: { from: "2026-02-31" } } as unknown as Request, response, next);
    expect(response.status).toHaveBeenCalledWith(400);
  });
  it("translates legacy JSON, actions and entity names instead of displaying raw codes", () => {
    const event = row({ action: "SUPER_ADMIN_USER_ROLE_STATUS_UPDATED", entity: "user", details: '{"role_id":{"from":2,"to":3},"is_active":true}' });
    expect(activityAction(event)).toBe("ইউজারের রোল ও সক্রিয়তা পরিবর্তন করেছেন");
    expect(activityEntity(event)).toBe("ইউজার");
    expect(activityDetails(event)).toContain("রোল আইডি: আগে: ২");
    expect(activityDetails(event)).toContain("সক্রিয়: হ্যাঁ");
    expect(activityDetails(event)).not.toContain("role_id");
  });
});
