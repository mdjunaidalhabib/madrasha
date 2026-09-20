import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({
  env: { smsWorkerEnabled: true, smsWorkerIntervalMs: 15000 },
}));
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../notifications/notification.service", () => ({ notificationService: { send: vi.fn() } }));

import { logger } from "../../../shared/logger/logger";
import { computeBackoffSeconds, SmsQueueService, SmsWorkerOptions } from "../sms-queue.service";

const NOW = new Date("2026-09-20T05:00:00.000Z");
const opts: SmsWorkerOptions = {
  batchSize: 10,
  backoffBaseSeconds: 60,
  backoffMaxSeconds: 3600,
  staleProcessingSeconds: 300,
  maxAgeHours: 12,
};

const item = (over: Record<string, unknown> = {}) => ({
  id: 1,
  madrasaId: 10,
  recipient: "01712345678",
  message: "hello",
  attempts: 1,
  maxAttempts: 3,
  createdAt: new Date(NOW.getTime() - 60_000),
  studentId: 501,
  ...over,
});

const build = (claimed: any[], sendImpl: (...a: any[]) => any) => {
  const repo: any = {
    recoverStale: vi.fn().mockResolvedValue(0),
    claimBatch: vi.fn().mockResolvedValue(claimed),
    markSent: vi.fn().mockResolvedValue({ count: 1 }),
    markRetry: vi.fn().mockResolvedValue({ count: 1 }),
    markFailed: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const sender: any = { send: vi.fn(sendImpl) };
  const service = new SmsQueueService(repo, sender, () => opts, () => NOW);
  return { repo, sender, service };
};

const ok = async () => ({ total: 1, sent: 1, failed: 0, results: [{ recipient: "x", status: "SENT" }] });
const fail = (error = "gateway down") => async () => ({
  total: 1,
  sent: 0,
  failed: 1,
  results: [{ recipient: "x", status: "FAILED", error }],
});

beforeEach(() => vi.clearAllMocks());

describe("backoff", () => {
  it("doubles per attempt and caps", () => {
    expect([1, 2, 3, 4].map((a) => computeBackoffSeconds(a, 60, 3600))).toEqual([60, 120, 240, 480]);
    expect(computeBackoffSeconds(20, 60, 3600)).toBe(3600);
  });
});

describe("SMS queue worker", () => {
  it("sends through NotificationService and marks the row SENT", async () => {
    const { repo, sender, service } = build([item()], ok);
    const res = await service.runOnce();
    expect(sender.send).toHaveBeenCalledWith(10, undefined, {
      channel: "SMS",
      recipients: ["01712345678"],
      message: "hello",
    });
    expect(repo.markSent).toHaveBeenCalledWith(1, NOW);
    expect(res).toMatchObject({ claimed: 1, sent: 1, retried: 0, failed: 0 });
  });

  it("recovers stale PROCESSING rows using the configured cutoff before claiming", async () => {
    const { repo, service } = build([], ok);
    repo.recoverStale.mockResolvedValue(2);
    const res = await service.runOnce();
    expect(repo.recoverStale).toHaveBeenCalledWith(new Date(NOW.getTime() - 300_000));
    expect(res?.recovered).toBe(2);
    expect(repo.recoverStale.mock.invocationCallOrder[0]).toBeLessThan(repo.claimBatch.mock.invocationCallOrder[0]);
  });

  it("on failure with attempts left: back to PENDING with exponential nextAttemptAt", async () => {
    const { repo, service } = build([item({ attempts: 2, maxAttempts: 5 })], fail("timeout"));
    const res = await service.runOnce();
    expect(repo.markRetry).toHaveBeenCalledWith(1, "timeout", new Date(NOW.getTime() + 120_000));
    expect(repo.markFailed).not.toHaveBeenCalled();
    expect(res).toMatchObject({ retried: 1, failed: 0, sent: 0 });
  });

  it("on failure at max attempts: marks FAILED permanently", async () => {
    const { repo, service } = build([item({ attempts: 3, maxAttempts: 3 })], fail("bad number"));
    const res = await service.runOnce();
    expect(repo.markFailed).toHaveBeenCalledWith(1, "bad number");
    expect(repo.markRetry).not.toHaveBeenCalled();
    expect(res).toMatchObject({ failed: 1 });
  });

  it("treats a thrown send as a failure (retry), not a crash", async () => {
    const { repo, service } = build([item({ attempts: 1 })], async () => {
      throw new Error("network");
    });
    const res = await service.runOnce();
    expect(repo.markRetry).toHaveBeenCalledWith(1, "network", new Date(NOW.getTime() + 60_000));
    expect(res?.retried).toBe(1);
  });

  it("fails an item older than the max age as 'expired' without sending", async () => {
    const { repo, sender, service } = build([item({ createdAt: new Date(NOW.getTime() - 13 * 3_600_000) })], ok);
    await service.runOnce();
    expect(sender.send).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith(1, "expired");
  });

  it("is single-flight: an overlapping pass does nothing", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { repo, service } = build([item()], async () => {
      await gate;
      return ok();
    });
    const first = service.runOnce();
    await Promise.resolve();
    await Promise.resolve();
    const overlapped = await service.runOnce();
    expect(overlapped).toBeNull();
    expect(repo.claimBatch).toHaveBeenCalledTimes(1);
    release();
    await first;
    // and it can run again afterwards
    expect(await service.runOnce()).not.toBeNull();
  });

  it("never logs the full phone number", async () => {
    const { service } = build([item()], ok);
    await service.runOnce();
    const logged = JSON.stringify([...(logger.info as any).mock.calls, ...(logger.warn as any).mock.calls]);
    expect(logged).not.toContain("01712345678");
    expect(logged).toContain("017****78");
  });

  it("a pass that throws (DB down) is contained and releases the lock", async () => {
    const { repo, service } = build([], ok);
    repo.claimBatch.mockRejectedValueOnce(new Error("db down"));
    await expect(service.runOnce()).resolves.toMatchObject({ claimed: 0 });
    expect(await service.runOnce()).not.toBeNull();
  });
});
