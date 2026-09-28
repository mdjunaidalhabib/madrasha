import { LOCALE_MAP, formatNumber, getLang, getText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceText } from "./attendanceDevice.text";

/** Number in the current UI language (name kept from when it was Bangla-only). */
export const toBnNumber = (n: number) => formatNumber(n, getLang());

export const todayIso = () => {
  // Local calendar date (not UTC) so "today" is right around midnight in BD.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parse = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (value: string | null | undefined, fallback = "—") => {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleString(LOCALE_MAP[getLang()], { dateStyle: "medium", timeStyle: "short" });
};

export const formatTime = (value: string | null | undefined, fallback = "—") => {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(LOCALE_MAP[getLang()], { hour: "2-digit", minute: "2-digit", hour12: true });
};

/** "3 min ago" style label (current UI language). `now` is passed in so callers re-render on a tick. */
export const relativeTime = (
  value: string | null | undefined,
  now: number = Date.now(),
  fallback?: string,
) => {
  const t = getText(attendanceDeviceText).time;
  const d = parse(value);
  if (!d) return fallback ?? t.never;

  const diffSec = Math.round((now - d.getTime()) / 1000);
  if (diffSec < 10) return t.justNow;
  if (diffSec < 60) return t.seconds(toBnNumber(diffSec));

  const min = Math.floor(diffSec / 60);
  if (min < 60) return t.minutes(toBnNumber(min));

  const hour = Math.floor(min / 60);
  if (hour < 24) return t.hours(toBnNumber(hour));

  const day = Math.floor(hour / 24);
  if (day < 30) return t.days(toBnNumber(day));

  const month = Math.floor(day / 30);
  if (month < 12) return t.months(toBnNumber(month));

  return t.years(toBnNumber(Math.floor(month / 12)));
};
