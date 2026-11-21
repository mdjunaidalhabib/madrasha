import { logger } from "../logger/logger";

/** Connectivity/pool failures only; schema, auth and constraint errors need intervention. */
export function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    (error as { code?: string; errorCode?: string }).code ??
    (error as { errorCode?: string }).errorCode;
  return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code ?? "");
}

/** Bounded retry for an idempotent maintenance job, never for arbitrary writes. */
export function createDatabaseMaintenanceJob(options: {
  name: string;
  checkConnection: () => Promise<unknown>;
  run: () => Promise<void>;
  retryDelaysMs?: readonly number[];
}) {
  const delays = options.retryDelaysMs ?? [30_000, 120_000, 300_000];
  let running = false;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  async function attempt(retry: number): Promise<void> {
    if (stopped || running) return;
    running = true;
    try {
      // Detect an outage before fan-out into the purge's parallel DB reads.
      await options.checkConnection();
      if (!stopped) await options.run();
    } catch (error) {
      if (stopped) return;
      if (isTransientDatabaseError(error) && retry < delays.length) {
        const delay = delays[retry];
        const details = error as { code?: string; errorCode?: string };
        logger.warn(options.name + " deferred: database temporarily unavailable", {
          code: details.code ?? details.errorCode,
          retry: retry + 1,
          retryInMs: delay,
        });
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void attempt(retry + 1);
        }, delay);
        retryTimer.unref();
      } else {
        logger.error(options.name + " failed", error);
      }
    } finally {
      running = false;
    }
  }

  return {
    async run(): Promise<void> {
      if (retryTimer || running || stopped) return;
      await attempt(0);
    },
    stop() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    },
  };
}
