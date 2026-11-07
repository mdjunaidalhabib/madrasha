import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { lock, log } = vi.hoisted(() => ({ lock: vi.fn(), log: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../subscriptions.repository", () => ({ subscriptionsRepository: { lock, log } }));
import { DomainSubscriptionsService } from "../domain-subscriptions.service";

const setup = () => {
  const tx = {};
  const repo = {
    transaction: vi.fn(async (fn) => fn(tx)),
    history: vi.fn(async () => 0),
    find: vi.fn(async (): Promise<any> => null),
    create: vi.fn(async (_tx, data) => ({ id: 1, ...data })),
    update: vi.fn(async (_tx, id, data) => ({ id, ...data })),
    connect: vi.fn(),
    disconnect: vi.fn(),
    list: vi.fn(),
  };
  return { service: new DomainSubscriptionsService(repo as any), repo, tx };
};
beforeEach(() => {
  lock.mockReset().mockResolvedValue({ id: 7 });
  log.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-07T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("domain add-on", () => {
  it("defaults a .com purchase to 3500 and institution ownership, and connects it", async () => {
    const { service, repo, tx } = setup();
    expect(await service.save(7, { domain: "School.COM" })).toMatchObject({
      amountPaid: 3500,
      registeredInNameOf: "institution",
      domain: "school.com",
    });
    expect(repo.connect).toHaveBeenCalledWith(tx, 7, "school.com");
    expect(log).toHaveBeenCalled();
  });
  it("defaults an existing domain renewal to 2500", async () => {
    const { service, repo } = setup();
    repo.history.mockResolvedValue(1);
    expect((await service.save(7, { domain: "school.com" })).amountPaid).toBe(2500);
  });
  it("requires a manual amount for another TLD and accepts platform ownership", async () => {
    const { service } = setup();
    await expect(service.save(7, { domain: "school.org" })).rejects.toThrow();
    expect(
      await service.save(7, {
        domain: "school.org",
        amountPaid: 4100,
        registeredInNameOf: "platform",
      }),
    ).toMatchObject({ amountPaid: 4100, registeredInNameOf: "platform" });
  });
  it("marks an expired add-on without disconnecting or deleting anything", async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([
      { domain: "school.com", amountPaid: 3500, endDate: new Date("2025-01-01"), isActive: 1 },
    ]);
    expect((await service.list(7))[0].expired).toBe(true);
    expect(repo.disconnect).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("scopes edits to the specified tenant and rejects cross-tenant IDs", async () => {
    const { service, repo, tx } = setup();
    await expect(service.save(7, { amountPaid: 1000 }, 88)).rejects.toThrow();
    expect(repo.find).toHaveBeenCalledWith(tx, 7, 88);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("only disconnects on explicit owner removal and keeps the audit record", async () => {
    const { service, repo, tx } = setup();
    repo.find.mockResolvedValue({ id: 88, domain: "school.com" });
    await service.remove(7, 88);
    expect(repo.update).toHaveBeenCalledWith(tx, 88, { isActive: 0 });
    expect(repo.disconnect).toHaveBeenCalledWith(tx, 7, "school.com");
  });
});
