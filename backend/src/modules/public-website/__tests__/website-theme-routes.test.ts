import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import jwt from "jsonwebtoken";
import routes from "../website.routes";
import { websiteService } from "../website.service";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/website", routes);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/website/super/madrasas`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => vi.restoreAllMocks());

describe("institution theme route permissions", () => {
  it.each(["GET", "PATCH"])("protects %s from unauthenticated and tenant-admin requests", async (method) => {
    const read = vi.spyOn(websiteService, "getWebsiteThemeBySuperAdmin").mockResolvedValue("modern");
    const write = vi.spyOn(websiteService, "updateWebsiteThemeBySuperAdmin").mockResolvedValue("heritage");
    expect((await fetch(`${base}/42/theme`, { method })).status).toBe(401);
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "admin", madrasa_id: 42 } as any);
    expect((await fetch(`${base}/42/theme`, { method, headers: { Authorization: "Bearer tenant" } })).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("allows a super admin to read and change the selected institution", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "super_admin" } as any);
    const read = vi.spyOn(websiteService, "getWebsiteThemeBySuperAdmin").mockResolvedValue("campus");
    const write = vi.spyOn(websiteService, "updateWebsiteThemeBySuperAdmin").mockResolvedValue("heritage");
    const headers = { Authorization: "Bearer super", "Content-Type": "application/json" };
    expect(await (await fetch(`${base}/42/theme`, { headers })).json()).toEqual({ theme_key: "campus" });
    const response = await fetch(`${base}/42/theme`, { method: "PATCH", headers, body: JSON.stringify({ theme_key: "heritage" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).theme_key).toBe("heritage");
    expect(read).toHaveBeenCalledWith(42);
    expect(write).toHaveBeenCalledWith(42, "heritage");
  });
});
