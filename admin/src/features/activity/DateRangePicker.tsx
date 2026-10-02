import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { LOCALE_MAP, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { activityText } from "./activity.text";

// Dates travel as local "YYYY-MM-DD" keys - the same shape the backend's
// from/to query params expect (it extends a date-only "to" to end of day).
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

type Props = {
  from: string;
  to: string;
  active: boolean;
  /** Oldest selectable day = today - (retentionDays - 1); older logs are purged anyway. */
  retentionDays: number;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
};

export default function DateRangePicker({ from, to, active, retentionDays, onApply, onClear }: Props) {
  const lang = useLang();
  const t = useText(activityText);
  const locale = LOCALE_MAP[lang];
  const wrapperRef = useRef<HTMLDivElement>(null);

  const today = startOfToday();
  const todayKey = toKey(today);
  const minKey = toKey(addDays(today, -(retentionDays - 1)));

  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [hover, setHover] = useState<string>("");
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Re-seed the draft from the applied range every time the popover opens.
  useEffect(() => {
    if (!open) return;
    setStart(from);
    setEnd(to);
    setHover("");
    const anchor = from ? fromKey(to || from) : today;
    setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fmt = (key: string, withYear = true) =>
    fromKey(key).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });

  const rangeLabel = (a: string, b: string) => {
    if (!a) return "";
    if (!b || a === b) return fmt(a);
    const sameYear = a.slice(0, 4) === b.slice(0, 4);
    return `${fmt(a, !sameYear)} – ${fmt(b)}`;
  };

  // Saturday-first in Bangla (local convention), Sunday-first in English.
  const weekStart = lang === "bn" ? 6 : 0;
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
  }, [locale, weekStart]);

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) list.push(toKey(new Date(first.getFullYear(), first.getMonth(), d)));
    while (list.length % 7) list.push(null);
    return list;
  }, [viewMonth, weekStart]);

  const canPrev = toKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0)) >= minKey;
  const canNext = toKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)) <= todayKey;

  const pickDay = (key: string) => {
    if (!start || end) {
      setStart(key);
      setEnd("");
    } else if (key < start) {
      setStart(key);
    } else {
      setEnd(key);
    }
  };

  // Live range while choosing the end day (hover preview).
  const previewEnd = start && !end && hover && hover >= start ? hover : end;
  const rangeEnd = previewEnd || start;

  const clampMin = (d: Date) => (toKey(d) < minKey ? minKey : toKey(d));
  const presets: { label: string; from: string; to: string }[] = [
    { label: t.presetToday, from: todayKey, to: todayKey },
    { label: t.presetYesterday, from: toKey(addDays(today, -1)), to: toKey(addDays(today, -1)) },
    { label: t.presetLast7, from: toKey(addDays(today, -6)), to: todayKey },
    { label: t.presetLast30, from: toKey(addDays(today, -29)), to: todayKey },
    {
      label: t.presetThisMonth,
      from: clampMin(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: todayKey,
    },
    {
      label: t.presetLastMonth,
      from: clampMin(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: toKey(new Date(today.getFullYear(), today.getMonth(), 0)),
    },
  ];

  const choosePreset = (p: { from: string; to: string }) => {
    setStart(p.from);
    setEnd(p.to);
    const anchor = fromKey(p.to);
    setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  };

  const selectedDays = start
    ? Math.round((fromKey(end || start).getTime() - fromKey(start).getTime()) / 86400000) + 1
    : 0;

  const apply = () => {
    if (!start) return;
    onApply(start, end || start);
    setOpen(false);
  };

  const triggerText = active && from ? rangeLabel(from, to) : t.rangePlaceholder;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex h-9 items-center rounded-full border text-sm font-medium transition ${
          active
            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-full items-center gap-2 ps-3.5 pe-3"
        >
          <CalendarDays size={16} className={active ? "text-white" : "text-slate-400"} />
          <span className="whitespace-nowrap">{triggerText}</span>
          {!active && <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} />}
        </button>
        {active && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t.clearLabel}
            className="me-1.5 flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/20"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          className="absolute start-0 top-full z-30 mt-2 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Presets */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 p-3 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-e dark:border-slate-800">
              {presets.map((p) => {
                const selected = start === p.from && (end || start) === p.to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => choosePreset(p)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-start text-sm transition ${
                      selected
                        ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                  aria-label={t.prevMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-800 rtl:rotate-180"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}
                </div>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                  aria-label={t.nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-800 rtl:rotate-180"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {weekdays.map((w) => (
                  <div key={w} className="pb-2">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover("")}>
                {cells.map((key, i) => {
                  if (!key) return <div key={`e${i}`} />;
                  const disabled = key > todayKey || key < minKey;
                  const isStart = key === start;
                  const isEnd = !!start && key === rangeEnd;
                  const inRange = !!start && key > start && key < rangeEnd;
                  const isToday = key === todayKey;
                  const edge = isStart || isEnd;
                  return (
                    <div
                      key={key}
                      className={`flex justify-center ${
                        inRange || (isStart && rangeEnd > start) || (isEnd && rangeEnd > start)
                          ? "bg-indigo-50 dark:bg-indigo-500/15"
                          : ""
                      } ${isStart && rangeEnd > start ? "rounded-s-full" : ""} ${
                        isEnd && rangeEnd > start ? "rounded-e-full" : ""
                      }`}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pickDay(key)}
                        onMouseEnter={() => setHover(key)}
                        className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                          edge
                            ? "bg-indigo-600 font-semibold text-white shadow-sm"
                            : disabled
                              ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                              : inRange
                                ? "text-indigo-800 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/25"
                                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        {localizeDigits(fromKey(key).getDate(), lang)}
                        {isToday && !edge && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {start ? (
                <>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {rangeLabel(start, end || start)}
                  </span>
                  <span className="mx-1.5">·</span>
                  {t.daysSelected(localizeDigits(selectedDays, lang))}
                </>
              ) : (
                t.pickStartHint
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t.cancelLabel}
              </Button>
              <Button variant="primary" onClick={apply} disabled={!start}>
                {t.applyLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
