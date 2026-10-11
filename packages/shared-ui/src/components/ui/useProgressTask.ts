import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressStep } from "./ProgressOverlay";

export interface ProgressTaskContext {
  /** Mark `n` (default 1) more steps as finished. */
  advance: (n?: number) => void;
}

export interface ProgressTaskOptions {
  /** Heading of the overlay. */
  title: string;
  /** Every step the task will run, in order. Plain strings are fine. */
  steps: Array<ProgressStep | string>;
  /** For ONE request that does many things server-side (so real progress is
   * unknown): walk through the steps on a timer, parking on the last step
   * until the request really finishes. */
  estimate?: boolean | { msPerStep: number };
  /** For callers that swallow request errors and resolve with a result:
   * return true when that result means "nothing worked", so the overlay ends
   * red instead of green. The result is still returned (no throw). */
  failedWhen?: (result: any) => boolean;
}

interface State {
  open: boolean;
  title: string;
  steps: ProgressStep[];
  completed: number;
  failed: boolean;
}

const CLOSED: State = { open: false, title: "", steps: [], completed: 0, failed: false };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const toSteps = (steps: ProgressTaskOptions["steps"]): ProgressStep[] =>
  steps.map((s, i) => (typeof s === "string" ? { id: `step-${i}`, label: s } : s));

/** Drives <ProgressOverlay>. Usage:
 *
 *   const task = useProgressTask();
 *   await task.run({ title, steps: ["A", "B"] }, async ({ advance }) => {
 *     await doA(); advance();
 *     await doB(); advance();
 *   });
 *   ...
 *   <ProgressOverlay {...task.overlayProps} />
 *
 * `run` shows the overlay, lets the bar reach 100% on success (then closes),
 * or turns the failing step red on error (then closes). Errors are RETHROWN,
 * so the caller's existing try/catch + toast keeps working unchanged. */
export function useProgressTask() {
  const [state, setState] = useState<State>(CLOSED);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((next: Partial<State>) => {
    if (mounted.current) setState((prev) => ({ ...prev, ...next }));
  }, []);

  const run = useCallback(
    async <T,>(options: ProgressTaskOptions, fn: (ctx: ProgressTaskContext) => Promise<T>): Promise<T> => {
      const steps = toSteps(options.steps);
      const total = steps.length;
      let completed = 0;
      let timer: ReturnType<typeof setInterval> | undefined;

      const setCompleted = (value: number) => {
        completed = Math.min(Math.max(value, 0), total);
        patch({ completed });
      };

      running.current = true;
      if (mounted.current) setState({ open: true, title: options.title, steps, completed: 0, failed: false });

      if (options.estimate) {
        const ms = typeof options.estimate === "object" ? options.estimate.msPerStep : 1100;
        timer = setInterval(() => {
          // Never claim the last step is done - only the real response does.
          if (completed < total - 1) setCompleted(completed + 1);
        }, ms);
      }

      try {
        const result = await fn({
          advance: (n = 1) => {
            if (!options.estimate) setCompleted(completed + n);
          },
        });
        if (timer) clearInterval(timer);
        if (options.failedWhen?.(result)) {
          patch({ failed: true });
          await wait(900);
          patch({ open: false, failed: false });
          return result;
        }
        setCompleted(total);
        await wait(450);
        patch({ open: false });
        return result;
      } catch (err) {
        if (timer) clearInterval(timer);
        patch({ failed: true });
        await wait(900);
        patch({ open: false, failed: false });
        throw err;
      } finally {
        running.current = false;
      }
    },
    [patch],
  );

  return {
    run,
    isRunning: state.open,
    overlayProps: {
      open: state.open,
      title: state.title,
      steps: state.steps,
      completed: state.completed,
      failed: state.failed,
    },
  };
}
