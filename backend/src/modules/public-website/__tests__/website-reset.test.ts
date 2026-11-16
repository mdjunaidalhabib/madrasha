import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import jwt from "jsonwebtoken";

const { reset } = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("../website-template.service", () => ({
  resetWebsiteToTemplate: reset,
  getWebsiteTemplate: vi.fn(),
  saveWebsiteTemplate: vi.fn(),
  uploadWebsiteTemplateImage: vi.fn(),
}));
import routes from "../website.routes";
import { BadRequestError } from "../../../shared/errors";

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
afterEach(() => { vi.restoreAllMocks(); reset.mockReset(); });

describe("super admin website reset", () => {
  it("rejects unauthenticated requests without calling reset", async () => {
    expect((await fetch(`${base}/42/reset`, { method: "POST" })).status).toBe(401);
    expect(reset).not.toHaveBeenCalled();
  });
  it("rejects tenant admin tokens", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "admin", madrasa_id: 42 } as any);
    expect((await fetch(`${base}/42/reset`, { method: "POST", headers: { Authorization: "Bearer tenant" } })).status).toBe(403);
    expect(reset).not.toHaveBeenCalled();
  });
  it("resets the requested institution for a super admin", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "super_admin" } as any);
    const response = await fetch(`${base}/42/reset`, { method: "POST", headers: { Authorization: "Bearer super" } });
    expect(response.status).toBe(200);
    expect(reset).toHaveBeenCalledWith(42);
  });
  it("returns validation errors from the reset service", async () => {
    vi.spyOn(jwt, "verify").mockReturnValue({ role: "super_admin" } as any);
    reset.mockRejectedValue(new BadRequestError("Invalid institution ID"));
    const response = await fetch(`${base}/invalid/reset`, { method: "POST", headers: { Authorization: "Bearer super" } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Invalid institution ID" });
  });
});
