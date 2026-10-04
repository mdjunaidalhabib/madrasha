import { useEffect, useMemo, useState } from "react";
import type { AttendanceDevice } from "../types";

const STORAGE_KEY = "attendanceDevice.enrollDeviceId";
let memoryChoice: number | null = null;

const readChoice = (): number | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : memoryChoice;
  } catch {
    return memoryChoice;
  }
};

const writeChoice = (id: number | null) => {
  memoryChoice = id;
  try {
    if (id == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // private window / blocked storage - the in-memory choice still works
  }
};

/**
 * Which K40 the card enrollment runs on. Only active devices count; with one
 * active device it's picked automatically, with several the operator's last
 * choice is remembered (per browser) and the backend gets an explicit id.
 */
export function useEnrollDevice(devices: AttendanceDevice[]) {
  const active = useMemo(() => devices.filter((d) => d.is_active), [devices]);
  const [chosen, setChosen] = useState<number | null>(readChoice);

  useEffect(() => {
    if (active.length === 0) return;
    if (chosen == null || !active.some((d) => d.id === chosen)) {
      setChosen(active[0].id);
    }
  }, [active, chosen]);

  const device = active.find((d) => d.id === chosen) ?? active[0] ?? null;

  return {
    activeDevices: active,
    device,
    deviceId: device?.id,
    setDeviceId: (id: number) => {
      writeChoice(id);
      setChosen(id);
    },
    connectorOnline: device ? device.status === "online" : false,
  };
}

export type EnrollDevice = ReturnType<typeof useEnrollDevice>;
