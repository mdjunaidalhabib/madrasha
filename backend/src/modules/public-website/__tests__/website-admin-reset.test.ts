import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import jwt from "jsonwebtoken";

const { reset } = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../website-template.service", () => ({
  resetWebsiteToTemplate: reset,
  getWebsiteTemplate: vi.fn(),
  saveWebsiteTemplate: vi.fn(),
  uploadWebsiteTemplateImage: vi.fn(),
}));
// Emulate the tenant already resolved by the shared tenant middleware.
// Authentication and permission checks below use the real middleware.
vi.mock("../../../shared/middleware/tenant.middleware", () => ({
  tenantMiddleware: (req: any, _res: any, next: () => void) => {
    req.tenant = { madrasa_id: 42, slug: "institution-42" };
    next();
  },
}));
import routes from "../website.routes";
import { prisma } from "../../../shared/database/prisma";
import { BadRequestError } from "../../../shared/errors";
import { hashPassword } from "../../../shared/utils/hash.util";

let server: Server;
let base: string;
let passwordHash: string;
beforeAll(async () => {
  passwordHash = await hashPassword("admin-secret");
  const app = express();
  app.use(express.json());
  app.use("/website", routes);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/website/admin/reset`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => { vi.restoreAllMocks(); reset.mockReset(); });

const headers = { Authorization: "Bearer tenant", "Content-Type": "application/json" };
const adminToken = (overrides = {}) => vi.spyOn(jwt, "verify").mockReturnValue({ id: 7, role: "admin", role_id: 3, madrasa_id: 42, ...overrides } as any);

describe("tenant admin website reset", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await fetch(base, { method: "POST" })).status).toBe(401);
    expect(reset).not.toHaveBeenCalled();
  });

  it("rejects tokens belonging to another institution", async () => {
    adminToken({ madrasa_id: 99 });
    expect((await fetch(base, { method: "POST", headers })).status).toBe(401);
    expect(reset).not.toHaveBeenCalled();
  });

  it("rejects guardian tokens", async () => {
    adminToken({ type: "guardian" });
    expect((await fetch(base, { method: "POST", headers })).status).toBe(401);
    expect(reset).not.toHaveBeenCalled();
  });

  it("requires website.manage permission", async () => {
    adminToken();
    vi.spyOn(prisma.rolePermission, "findMany").mockResolvedValue([]);
    expect((await fetch(base, { method: "POST", headers })).status).toBe(403);
    expect(reset).not.toHaveBeenCalled();
  });

  it("resets only the authenticated tenant despite spoofed body and query IDs", async () => {
    adminToken();
    const account = vi.spyOn(prisma.user, "findFirst").mockResolvedValue({ passwordHash } as any);
    vi.spyOn(prisma.rolePermission, "findMany").mockResolvedValue([{ permission: { keyName: "website.manage" } }] as any);
    const response = await fetch(`${base}?madrasa_id=99`, { method: "POST", headers, body: JSON.stringify({ madrasa_id: 99, password: "admin-secret" }) });
    expect(response.status).toBe(200);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(42);
    expect(account).toHaveBeenCalledWith({ where: { id: 7, madrasaId: 42 }, select: { passwordHash: true } });
  });

  it.each([undefined, "", "wrong-password", 123, {}])("rejects missing or incorrect passwords: %s", async (password) => {
    adminToken({ role: "MUHTAMIM" });
    vi.spyOn(prisma.user, "findFirst").mockResolvedValue({ passwordHash } as any);
    const response = await fetch(base, { method: "POST", headers, body: JSON.stringify({ password }) });
    expect(response.status).toBe(400);
    expect(reset).not.toHaveBeenCalled();
  });

  it("returns reset errors so the panel can recover", async () => {
    adminToken({ role: "MUHTAMIM" });
    vi.spyOn(prisma.user, "findFirst").mockResolvedValue({ passwordHash } as any);
    reset.mockRejectedValue(new BadRequestError("Reset unavailable"));
    const response = await fetch(base, { method: "POST", headers, body: JSON.stringify({ password: "admin-secret" }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Reset unavailable" });
  });
});
