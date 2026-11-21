import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../logger/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
import { logger } from "../../logger/logger";
import { createDatabaseMaintenanceJob, isTransientDatabaseError } from "../maintenance-job";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("database maintenance recovery", () => {
  it("does not start the purge while the DB is unavailable and recovers on retry", async () => {
    const checkConnection = vi.fn().mockRejectedValueOnce({ code: "P1001" }).mockResolvedValue(1);
    const run = vi.fn(async () => {});
    const job = createDatabaseMaintenanceJob({ name: "Trash auto-purge", checkConnection, run });
    await job.run();
    expect(run).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Trash auto-purge deferred: database temporarily unavailable",
      { code: "P1001", retry: 1, retryInMs: 30_000 },
    );
    expect(logger.error).not.toHaveBeenCalled();
    await job.run(); // The periodic timer cannot bypass the pending retry.
    expect(checkConnection).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(checkConnection).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(1);
    job.stop();
  });

  it("bounds retries when a connection drops during the purge itself", async () => {
    const run = vi.fn().mockRejectedValue({ code: "P1017" });
    const job = createDatabaseMaintenanceJob({
      name: "Trash auto-purge",
      checkConnection: async () => 1,
      run,
      retryDelaysMs: [10, 20],
    });
    await job.run();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    expect(run).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith("Trash auto-purge failed", { code: "P1017" });
    expect(vi.getTimerCount()).toBe(0);
    job.stop();
  });

  it("reports schema failures immediately instead of retrying them", async () => {
    const error = { code: "P2022" };
    const run = vi.fn(async () => {
      throw error;
    });
    const job = createDatabaseMaintenanceJob({
      name: "Trash auto-purge",
      checkConnection: async () => 1,
      run,
    });
    await job.run();
    expect(logger.error).toHaveBeenCalledWith("Trash auto-purge failed", error);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    job.stop();
  });

  it("never overlaps two cleanup runs", async () => {
    let release!: () => void;
    const checkConnection = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const run = vi.fn(async () => {});
    const job = createDatabaseMaintenanceJob({ name: "Trash auto-purge", checkConnection, run });
    const first = job.run();
    await job.run();
    expect(checkConnection).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(run).toHaveBeenCalledTimes(1);
    job.stop();
  });

  it("cancels queued retries on shutdown", async () => {
    const checkConnection = vi.fn().mockRejectedValue({ errorCode: "P1001" });
    const run = vi.fn(async () => {});
    const job = createDatabaseMaintenanceJob({ name: "Trash auto-purge", checkConnection, run });
    await job.run();
    job.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    await job.run();
    expect(checkConnection).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  it("does not start work if shutdown happens during the connection check", async () => {
    let release!: () => void;
    const run = vi.fn(async () => {});
    const job = createDatabaseMaintenanceJob({
      name: "Trash auto-purge",
      checkConnection: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      run,
    });
    const pending = job.run();
    job.stop();
    release();
    await pending;
    expect(run).not.toHaveBeenCalled();
  });

  it("recognizes Prisma connection and pool codes but not application errors", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024"])
      expect(isTransientDatabaseError({ code })).toBe(true);
    expect(isTransientDatabaseError({ errorCode: "P1001" })).toBe(true);
    for (const error of [
      null,
      "P1001",
      new Error("constraint"),
      { code: "P2002" },
      { code: "P2022" },
    ])
      expect(isTransientDatabaseError(error)).toBe(false);
  });
});
