import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn().mockResolvedValue("ACTIVE") }));
import { WebsiteService, websiteService } from "../website.service";
import routes from "../website.routes";
import { getSubscriptionState } from "../../../shared/subscription/subscription-state";

beforeEach(() => vi.mocked(getSubscriptionState).mockResolvedValue("ACTIVE"));

const institution = { id: 1, name: "আহমদিয়া মাদ্রাসা", slug: "ahmadiya", isActive: 1, websiteStatus: "active", address: "ঢাকা", reportLogo: "data:image/png;base64,logo" };
const setup = (madrasa: any = institution, settings: any = { isPublished: 1, heroSubtitle: "নিজস্ব পরিচিতি" }) => {
  const repository = { findPublicMadrasaBySlug: vi.fn().mockResolvedValue(madrasa), findSettings: vi.fn().mockResolvedValue(settings) };
  return { repository, service: new WebsiteService(repository as any) };
};

describe("public share metadata", () => {
  it("uses institution branding and returns only public metadata", async () => {
    const { repository, service } = setup();
    const data = await service.getPublicShareMetadata("ahmadiya");
    expect(repository.findPublicMadrasaBySlug).toHaveBeenCalledWith("ahmadiya");
    expect(data).toEqual({ name: institution.name, slug: "ahmadiya", description: "নিজস্ব পরিচিতি", logoVersion: expect.stringMatching(/^[a-f0-9]{16}$/) });
    const changed = await setup({ ...institution, reportLogo: "new-logo" }).service.getPublicShareMetadata("ahmadiya");
    expect(changed.logoVersion).not.toBe(data.logoVersion);
  });

  it("supports missing settings and logos", async () => {
    const { service } = setup({ ...institution, reportLogo: null }, null);
    expect(await service.getPublicShareMetadata("ahmadiya")).toEqual({ name: institution.name, slug: "ahmadiya", description: institution.address, logoVersion: null });
  });

  it.each([
    [null, null, 404],
    [{ ...institution, isActive: 0 }, null, 403],
    [{ ...institution, websiteStatus: "disabled" }, null, 403],
    [institution, { isPublished: 0 }, 403],
  ])("rejects missing or unavailable websites (%#)", async (madrasa, settings, statusCode) => {
    await expect(setup(madrasa, settings).service.getPublicShareMetadata("ahmadiya")).rejects.toMatchObject({ statusCode });
  });
});

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use("/website", routes);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/website`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it("serves share metadata anonymously by slug", async () => {
  const get = vi.spyOn(websiteService, "getPublicShareMetadata").mockResolvedValue({ name: "School", slug: "school", description: "School", logoVersion: null });
  const response = await fetch(`${base}/public/school/share`);
  expect(response.status).toBe(200);
  expect((await response.json()).data.name).toBe("School");
  expect(get).toHaveBeenCalledWith("school");
});

it("resolves the registered institution for custom-domain previews", async () => {
  const resolve = vi.spyOn(websiteService, "resolveDomainToSlug").mockResolvedValue({ slug: "school" });
  vi.spyOn(websiteService, "getPublicShareMetadata").mockResolvedValue({ name: "School", slug: "school", description: "School", logoVersion: null });
  const response = await fetch(`${base}/share?host=School.edu.bd`);
  expect(response.status).toBe(200);
  expect(resolve).toHaveBeenCalledWith("school.edu.bd");
  expect((await response.json()).data.slug).toBe("school");
});
