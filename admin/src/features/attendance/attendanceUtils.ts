import { formatDate, formatDateTime, type Lang } from "@madrasha/shared-ui/src/i18n";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { PROTECTED_ATTENDANCE_SOURCES, type AttendanceStatus } from "../../services/phase1Api";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "LEAVE"];

/** Colour per status: [selected button, badge]. */
export const STATUS_STYLE: Record<AttendanceStatus, { on: string; badge: string; text: string }> = {
  PRESENT: {
    on: "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-600 dark:bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  LATE: {
    on: "border-amber-500 bg-amber-500 text-white dark:border-amber-600 dark:bg-amber-600",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    text: "text-amber-700 dark:text-amber-400",
  },
  ABSENT: {
    on: "border-rose-500 bg-rose-500 text-white dark:border-rose-600 dark:bg-rose-600",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    text: "text-rose-700 dark:text-rose-400",
  },
  LEAVE: {
    on: "border-sky-500 bg-sky-500 text-white dark:border-sky-600 dark:bg-sky-600",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    text: "text-sky-700 dark:text-sky-400",
  },
};

export const isProtectedSource = (source?: string | null) => !!source && PROTECTED_ATTENDANCE_SOURCES.includes(source);

/** Local (not UTC) YYYY-MM-DD. */
export const localIsoDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatIsoDate = (iso: string, lang: Lang, options?: Intl.DateTimeFormatOptions) => {
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDate(date, lang, options ?? { year: "numeric", month: "long", day: "numeric" });
};

export const formatTime = (value: string | null | undefined, lang: Lang) =>
  value ? formatDateTime(value, lang, { hour: "numeric", minute: "2-digit" }) : "";

/** Error body contains a machine code such as `reason_required`. */
export const apiErrorHas = (err: unknown, code: string) => {
  try {
    return JSON.stringify((err as any)?.response?.data ?? "").includes(code);
  } catch {
    return false;
  }
};

export const apiErrorMessage = (err: unknown, fallback: string) =>
  (err as any)?.response?.data?.message || fallback;

/** Client-side mirror of the backend permission check. */
export function useAttendancePermissions() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  return {
    canMark: hasPermission(user, permissions, "attendance.mark"),
    canEdit: hasPermission(user, permissions, "attendance.edit"),
    canPolicy: hasPermission(user, permissions, "attendance.policy"),
  };
}

