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

export type ClassOption = { id: number; name: string };

const asList = (payload: any): any[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

/** All classes across every division (the API only answers per-division). */
export function useClassOptions() {
  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const divisions = asList(await cachedGet("/madrasa-divisions"));
        const lists = await Promise.all(
          divisions.map((d) =>
            cachedGet(`/madrasa-classes?division_id=${d.division_id}`).then(asList),
          ),
        );
        if (cancelled) return;
        setClasses(
          lists
            .flat()
            .filter((c) => c && c.class_id != null)
            .map((c) => ({ id: Number(c.class_id), name: String(c.class_name_bn ?? c.class_id) })),
        );
      } catch {
        if (!cancelled) setClasses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return classes;
}
