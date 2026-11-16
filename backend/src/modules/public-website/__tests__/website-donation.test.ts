import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import jwt from "jsonwebtoken";

vi.mock("../../../shared/middleware/tenant.middleware", () => ({
  tenantMiddleware: (req: any, _res: any, next: () => void) => {
    req.tenant = { madrasa_id: 42, slug: "institution-42" }; next();
  },
}));
import routes from "../website.routes";
import { donationConfigSchema, publicDonationConfig, websiteDonationService } from "../website-donation.service";
import { prisma } from "../../../shared/database/prisma";
import * as templateService from "../website-template.service";
import { DEFAULT_WEBSITE_TEMPLATE, websiteTemplateSchema } from "../website-template.schema";

const config = {
  published: true, title: "Support education", description: "", instructions: "",
  contactPhone: "+8801700000000", checkoutUrl: "",
  methods: [{ type: "bkash", accountName: "Institution", accountNumber: "01700000000", details: "Merchant" }],
};
afterEach(() => vi.restoreAllMocks());

describe("donation publication and validation", () => {
  it("accepts dropdown wallet types and structured bank details", () => {
    const wallet = { ...config, methods: [{ ...config.methods[0], accountType: "merchant" }] };
    expect(donationConfigSchema.safeParse(wallet).success).toBe(true);
    const bank = { ...config, methods: [{ ...config.methods[0], type: "bank", accountType: "current", bankName: "Test bank", branchName: "Test branch", routingNumber: "012345678" }] };
    expect(donationConfigSchema.safeParse(bank).success).toBe(true);
    expect(donationConfigSchema.safeParse({ ...bank, methods: [{ ...bank.methods[0], routingNumber: "123" }] }).success).toBe(false);
    expect(donationConfigSchema.safeParse({ ...bank, methods: [{ ...bank.methods[0], branchName: "" }] }).success).toBe(false);
  });
  it("rejects incompatible account types and bank fields on wallets", () => {
    expect(donationConfigSchema.safeParse({ ...config, methods: [{ ...config.methods[0], accountType: "savings" }] }).success).toBe(false);
    expect(donationConfigSchema.safeParse({ ...config, methods: [{ ...config.methods[0], bankName: "Test bank" }] }).success).toBe(false);
  });
  it("adds donation defaults to templates saved before donations existed", () => {
    const { donation: _donation, ...oldTemplate } = DEFAULT_WEBSITE_TEMPLATE;
    expect(websiteTemplateSchema.parse(oldTemplate).donation).toEqual(DEFAULT_WEBSITE_TEMPLATE.donation);
  });
  it("personalizes the super admin demo as an unpublished draft with no payment destination", async () => {
    vi.spyOn(prisma.madrasa, "findFirst").mockResolvedValue({ id: 42, name: "Our institution" } as any);
    vi.spyOn(prisma.websiteDonationSettings, "findUnique").mockResolvedValue({ allowed: true, config: {} } as any);
    const content = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    content.donation = { title: "Support {{institution_name}}", description: "Latest demo", instructions: "Contact the office", isPublished: 1 };
    vi.spyOn(templateService, "getWebsiteTemplate").mockResolvedValue({ content, updatedAt: null });
    const result = await websiteDonationService.get(42);
    expect(result.config).toEqual({ published: false, title: "Support Our institution", description: "Latest demo",
      instructions: "Contact the office", contactPhone: "", checkoutUrl: "", methods: [] });
  });
  it("does not overwrite an existing institution's content when re-granting access", async () => {
    vi.spyOn(prisma.madrasa, "findFirst").mockResolvedValue({ id: 42, name: "Institution" } as any);
    vi.spyOn(templateService, "getWebsiteTemplate").mockResolvedValue({ content: DEFAULT_WEBSITE_TEMPLATE, updatedAt: null });
    const upsert = vi.spyOn(prisma.websiteDonationSettings, "upsert").mockResolvedValue({ allowed: true } as any);
    await websiteDonationService.setAccess(42, { allowed: true });
    expect(upsert).toHaveBeenCalledWith({ where: { madrasaId: 42 },
      create: expect.objectContaining({ madrasaId: 42, allowed: true, config: expect.objectContaining({ published: false, methods: [] }) }),
      update: { allowed: true } });
  });
  it("does not expose a demo endpoint to an institution without access", async () => {
    vi.spyOn(prisma.websiteDonationSettings, "findUnique").mockResolvedValue(null);
    const template = vi.spyOn(templateService, "getWebsiteTemplate");
    await expect(websiteDonationService.demo(42)).rejects.toMatchObject({ statusCode: 403 });
    expect(template).not.toHaveBeenCalled();
  });
  it("hides missing, unapproved, revoked, draft and malformed settings", () => {
    expect(publicDonationConfig(null)).toBeNull();
    expect(publicDonationConfig({ allowed: false, config })).toBeNull();
    expect(publicDonationConfig({ allowed: true, config: { ...config, published: false } })).toBeNull();
    expect(publicDonationConfig({ allowed: true, config: {} })).toBeNull();
    expect(publicDonationConfig({ allowed: true, config })).toEqual(config);
  });
  it("requires a title and payment destination before publication", () => {
    expect(donationConfigSchema.safeParse({ ...config, methods: [] }).success).toBe(false);
    expect(donationConfigSchema.safeParse({ ...config, title: " " }).success).toBe(false);
    expect(donationConfigSchema.safeParse({ ...config, methods: [], checkoutUrl: "https://pay.example.org/donate" }).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "http://pay.example.org", "https://user:pass@pay.example.org", "//pay.example.org"])("rejects unsafe payment links: %s", (checkoutUrl) => {
    expect(donationConfigSchema.safeParse({ ...config, checkoutUrl }).success).toBe(false);
  });
  it("rejects permission escalation hidden in config", () => {
    expect(donationConfigSchema.safeParse({ ...config, allowed: true }).success).toBe(false);
  });
  it("defaults to denied when the institution has no grant", async () => {
    vi.spyOn(prisma.madrasa, "findFirst").mockResolvedValue({ id: 42 } as any);
    vi.spyOn(prisma.websiteDonationSettings, "findUnique").mockResolvedValue(null);
    expect(await websiteDonationService.get(42)).toEqual({ allowed: false, config: null });
  });
  it("atomically scopes configuration saves to a granted, existing institution", async () => {
    const update = vi.spyOn(prisma.websiteDonationSettings, "updateMany").mockResolvedValue({ count: 0 });
    await expect(websiteDonationService.save(42, config)).rejects.toMatchObject({ statusCode: 403 });
    expect(update).toHaveBeenCalledWith({ where: { madrasaId: 42, allowed: true, madrasa: { deletedAt: null } }, data: { config } });
  });
});

describe("donation route authorization", () => {
  let server: Server;
  let base: string;
  const headers = { Authorization: "Bearer token", "Content-Type": "application/json" };
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use("/website", routes);
    server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    base = `http://127.0.0.1:${(server.address() as any).port}/website`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  it.each(["GET", "PATCH"])("restricts super admin %s route", async (method) => {
    expect((await fetch(`${base}/super/madrasas/42/donations`, { method })).status).toBe(401);
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "MUHTAMIM", madrasa_id: 42 } as any);
    expect((await fetch(`${base}/super/madrasas/42/donations`, { method, headers })).status).toBe(403);
  });
  it("allows the super admin to grant and revoke access", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "super_admin" } as any);
    const access = vi.spyOn(websiteDonationService, "setAccess").mockResolvedValue({ allowed: true });
    for (const allowed of [true, false]) {
      const response = await fetch(`${base}/super/madrasas/42/donations`, { method: "PATCH", headers, body: JSON.stringify({ allowed }) });
      expect(response.status).toBe(200); expect(access).toHaveBeenLastCalledWith(42, { allowed });
    }
  });
  it("requires website.manage and rejects other tenants", async () => {
    const token = vi.spyOn(jwt, "verify").mockReturnValue({ role: "admin", role_id: 3, madrasa_id: 42 } as any);
    vi.spyOn(prisma.rolePermission, "findMany").mockResolvedValue([]);
    expect((await fetch(`${base}/admin/donations`, { method: "PUT", headers, body: JSON.stringify(config) })).status).toBe(403);
    token.mockReturnValue({ role: "MUHTAMIM", madrasa_id: 99 } as any);
    expect((await fetch(`${base}/admin/donations`, { headers })).status).toBe(401);
  });
  it("uses the authenticated tenant despite a spoofed query ID", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "MUHTAMIM", role_id: 3, madrasa_id: 42 } as any);
    const save = vi.spyOn(websiteDonationService, "save").mockResolvedValue(config as any);
    const response = await fetch(`${base}/admin/donations?madrasa_id=99`, { method: "PUT", headers, body: JSON.stringify(config) });
    expect(response.status).toBe(200); expect(save).toHaveBeenCalledWith(42, config);
  });
  it("scopes demo text to the authenticated tenant", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "MUHTAMIM", role_id: 3, madrasa_id: 42 } as any);
    const demo = vi.spyOn(websiteDonationService, "demo").mockResolvedValue({ ...config, published: false, methods: [] } as any);
    expect((await fetch(`${base}/admin/donations/demo?madrasa_id=99`, { headers })).status).toBe(200);
    expect(demo).toHaveBeenCalledWith(42);
  });
});
