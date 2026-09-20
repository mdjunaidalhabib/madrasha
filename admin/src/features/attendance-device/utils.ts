export const toBnNumber = (n: number) => n.toLocaleString("bn-BD");

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
  return d.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
};

export const formatTime = (value: string | null | undefined, fallback = "—") => {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit", hour12: true });
};

/** "৩ মিনিট আগে" style label. `now` is passed in so callers re-render on a tick. */
export const relativeTime = (
  value: string | null | undefined,
  now: number = Date.now(),
  fallback = "কখনো নয়",
) => {
  const d = parse(value);
  if (!d) return fallback;

  const diffSec = Math.round((now - d.getTime()) / 1000);
  if (diffSec < 10) return "এইমাত্র";
  if (diffSec < 60) return `${toBnNumber(diffSec)} সেকেন্ড আগে`;

  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${toBnNumber(min)} মিনিট আগে`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${toBnNumber(hour)} ঘণ্টা আগে`;

  const day = Math.floor(hour / 24);
  if (day < 30) return `${toBnNumber(day)} দিন আগে`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${toBnNumber(month)} মাস আগে`;

  return `${toBnNumber(Math.floor(month / 12))} বছর আগে`;
};
