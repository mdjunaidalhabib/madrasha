import { useCallback, useEffect, useRef, useState } from "react";
import { cachedGet } from "../../services/api";
import { attendanceDeviceApi } from "../../services/attendanceDeviceApi";
import type { AttendanceDevice } from "./types";

/** Re-renders the caller every `ms` so relative-time labels stay fresh. */
export function useTick(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/**
 * Runs `load` immediately and then every `intervalMs` while the tab is
 * visible. Coming back to a hidden tab triggers an immediate refresh.
 * `load` may change identity (e.g. filters) - the schedule restarts then.
 */
export function useVisibleInterval(load: () => void, intervalMs: number) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => loadRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        loadRef.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}

/** Device list with live status, auto-refreshed while the page is visible. */
export function useDeviceStatus(intervalMs: number) {
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<AttendanceDevice[] | null> => {
    try {
      const list = await attendanceDeviceApi.listStatus({ silent: true });
      if (!mounted.current) return null;
      setDevices(list);
      setError(false);
      return list;
    } catch {
      if (mounted.current) setError(true);
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useVisibleInterval(refresh, intervalMs);

  return { devices, setDevices, loading, error, refresh };
}

export type ClassOption = { id: number; name: string; divisionId: number | null };
export type DivisionOption = { id: number; name: string };

const asList = (payload: any): any[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

/** Divisions + all their classes, in the madrasa's own order (the classes API only answers per-division). */
export function useClassTree() {
  const [tree, setTree] = useState<{ divisions: DivisionOption[]; classes: ClassOption[] }>({
    divisions: [],
    classes: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const divisions = asList(await cachedGet("/madrasa-divisions"));
        const lists = await Promise.all(
          divisions.map((d) =>
            cachedGet(`/madrasa-classes?division_id=${d.division_id}`)
              .then(asList)
              .then((list) => list.map((c) => ({ ...c, division_id: c.division_id ?? d.division_id })))
              .catch(() => [] as any[]),
          ),
        );
        if (cancelled) return;
        setTree({
          divisions: divisions
            .filter((d) => d && d.division_id != null)
            .map((d) => ({ id: Number(d.division_id), name: String(d.division_name_bn ?? d.division_id) })),
          classes: lists
            .flat()
            .filter((c) => c && c.class_id != null)
            .map((c) => ({
              id: Number(c.class_id),
              name: String(c.class_name_bn ?? c.class_id),
              divisionId: c.division_id == null ? null : Number(c.division_id),
            })),
        });
      } catch {
        if (!cancelled) setTree({ divisions: [], classes: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return tree;
}

/** All classes across every division. */
export function useClassOptions() {
  return useClassTree().classes;
}
