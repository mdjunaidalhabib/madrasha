import { create } from "zustand";
import { useEffect, useRef } from "react";
import { useToastStore } from "../store/toastStore";
import { getText } from "../i18n";
import { navText } from "./nav.text";
import { confirmDiscardIfDirty, suppressUnloadWarningOnce } from "./unsavedChanges";

/**
 * Global refresh coordination.
 *
 * - `refreshKey` is mixed into the layout's route-outlet key, so a soft refresh
 *   remounts the current page and every effect-based fetch on it runs again -
 *   without a full browser reload (auth tokens / session in memory + storage stay).
 * - App-level data (sidebar, plan, profile, caches...) registers a *global
 *   refresher* with `useRegisterRefresher`. Its synchronous part runs first
 *   (e.g. clearing a GET cache), so the remounted page doesn't read stale data.
 * - A page that can refetch in place (keeping filters/scroll) may register
 *   `usePageRefresh(fn)`; if any page handler exists it is used INSTEAD of the
 *   remount.
 * - Only one refresh runs at a time; extra clicks while it runs are ignored.
 */
type Refresher = () => unknown | Promise<unknown>;

type RefreshState = { refreshKey: number; refreshing: boolean };

export const useRefreshStore = create<RefreshState>(() => ({ refreshKey: 0, refreshing: false }));

const globalRefreshers = new Set<Refresher>();
const pageRefreshers = new Set<Refresher>();

export const registerRefresher = (fn: Refresher) => {
  globalRefreshers.add(fn);
  return () => {
    globalRefreshers.delete(fn);
  };
};

const registerPageRefresher = (fn: Refresher) => {
  pageRefreshers.add(fn);
  return () => {
    pageRefreshers.delete(fn);
  };
};

/** App-level data refresh (call from the layout). `fn` may change every render. */
export function useRegisterRefresher(fn: Refresher) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => registerRefresher(() => ref.current()), []);
}

/** Page-level in-place refetch (optional). Replaces the remount while mounted. */
export function usePageRefresh(fn: Refresher) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => registerPageRefresher(() => ref.current()), []);
}

const MIN_SPINNER_MS = 600;
let inFlight: Promise<boolean> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runSoftRefresh(): Promise<boolean> {
  const startedAt = Date.now();
  useRefreshStore.setState({ refreshing: true });
  let ok = true;
  try {
    // 1) App-level refreshers: sync part (cache clearing) runs right now.
    const globalRuns = [...globalRefreshers].map((fn) => {
      try {
        return Promise.resolve(fn());
      } catch (err) {
        return Promise.reject(err);
      }
    });

    // 2) Current page: in-place handlers if any, otherwise remount via key.
    let pageRuns: Promise<unknown>[] = [];
    if (pageRefreshers.size > 0) {
      pageRuns = [...pageRefreshers].map((fn) => {
        try {
          return Promise.resolve(fn());
        } catch (err) {
          return Promise.reject(err);
        }
      });
    } else {
      useRefreshStore.setState((s) => ({ refreshKey: s.refreshKey + 1 }));
    }

    const results = await Promise.allSettled([...globalRuns, ...pageRuns]);
    ok = results.every((r) => r.status === "fulfilled");
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPINNER_MS) await sleep(MIN_SPINNER_MS - elapsed);
    useRefreshStore.setState({ refreshing: false });
  }
  return ok;
}

/** Soft refresh. Safe to call repeatedly: duplicates join the running one. */
export async function requestRefresh(): Promise<boolean> {
  const t = getText(navText);
  if (inFlight) return inFlight;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    useToastStore.getState().show(t.offline, "error");
    return false;
  }
  if (!(await confirmDiscardIfDirty())) return false;
  if (inFlight) return inFlight; // another click won the race while the dialog was open

  inFlight = runSoftRefresh()
    .then((ok) => {
      if (!ok) useToastStore.getState().show(t.refreshFailed, "error");
      return ok;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Full browser reload - session survives because tokens live in storage/cookies. */
export async function requestFullReload(): Promise<void> {
  if (inFlight) return;
  if (!(await confirmDiscardIfDirty())) return;
  suppressUnloadWarningOnce(); // we already asked; don't show the native prompt too
  window.location.reload();
}
