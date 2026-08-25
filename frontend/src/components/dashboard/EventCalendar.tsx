import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X, Check } from "lucide-react";
import { toBanglaDigits } from "../../utils/reportUtils";
import { EVENT_TYPE_LABELS, EventType } from "../../services/eventApi";

export type CalendarItem = {
  id: number | string;
  kind: "exam" | "event";
  date: string;
  title: string;
  subtitle?: string;
  type?: EventType;
  startTime?: string | null;
  endTime?: string | null;
};

type NewEventInput = {
  title: string;
  type: EventType;
  event_date: string;
  start_time?: string;
  end_time?: string;
};

type Props = {
  items: CalendarItem[];
  onAdd?: (input: NewEventInput) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
};

const MONTH_NAMES = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

const WEEKDAY_NAMES = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];

const TYPE_DOT_COLOR: Record<string, string> = {
  exam: "bg-amber-500",
  MEETING: "bg-indigo-500",
  NOTICE: "bg-sky-500",
  HOLIDAY: "bg-rose-500",
  OTHER: "bg-slate-400",
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  exam: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  MEETING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  NOTICE: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  HOLIDAY: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  OTHER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyForm: NewEventInput = { title: "", type: "MEETING", event_date: "" };

export default function EventCalendar({ items, onAdd, onDelete }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<string>(dateKey(today));
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewEventInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items || []) {
      const key = dateKey(new Date(item.date));
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewDate]);

  const selectedItems = itemsByDate.get(selected) || [];

  const openAddForm = () => {
    setForm({ ...emptyForm, event_date: selected });
    setShowAddForm(true);
  };

  const submitAdd = async () => {
    if (!form.title.trim() || !onAdd || saving) return;
    setSaving(true);
    try {
      await onAdd({
        title: form.title.trim(),
        type: form.type,
        event_date: form.event_date || selected,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
      });
      setShowAddForm(false);
      setForm(emptyForm);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays size={16} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">ক্যালেন্ডার</h3>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {MONTH_NAMES[viewDate.getMonth()]} {toBanglaDigits(viewDate.getFullYear())}
        </span>
        <button
          type="button"
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const key = dateKey(date);
          const isToday = key === dateKey(today);
          const isSelected = key === selected;
          const dayItems = itemsByDate.get(key);

          return (
            <div key={i} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setSelected(key);
                  setShowAddForm(false);
                }}
                className={`relative flex h-7 w-7 flex-col items-center justify-center rounded-full text-xs transition ${
                  isSelected
                    ? "bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-600/30"
                    : isToday
                      ? "border-2 border-indigo-400 font-semibold text-indigo-600 dark:text-indigo-400"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {toBanglaDigits(date.getDate())}
                {dayItems?.length ? (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {Array.from(new Set(dayItems.map((it) => it.type || it.kind)))
                      .slice(0, 3)
                      .map((k) => (
                        <span
                          key={k}
                          className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : TYPE_DOT_COLOR[k] || "bg-amber-500"}`}
                        />
                      ))}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {selectedItems.length ? "এই দিনের কার্যক্রম" : "এই দিনে কোনো কার্যক্রম নেই"}
          </p>
          {onAdd && (
            <button
              type="button"
              onClick={() => (showAddForm ? setShowAddForm(false) : openAddForm())}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition hover:bg-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400"
              title="নতুন যোগ করুন"
            >
              {showAddForm ? <X size={12} /> : <Plus size={12} />}
            </button>
          )}
        </div>

        {selectedItems.length > 0 && (
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      TYPE_BADGE_CLASS[item.kind === "exam" ? "exam" : item.type || "OTHER"]
                    }`}
                  >
                    {item.kind === "exam" ? "পরীক্ষা" : EVENT_TYPE_LABELS[item.type || "OTHER"]}
                  </span>
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {item.title}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : ""}
                </span>
                {item.kind === "event" && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(Number(item.id))}
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    title="মুছুন"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {showAddForm && onAdd && (
          <div className="mt-3 space-y-2 rounded-lg border border-indigo-200 bg-white p-2.5 dark:border-indigo-800 dark:bg-slate-900">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="শিরোনাম (যেমন: শিক্ষক মিটিং)"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="flex gap-1.5">
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as EventType }))}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={form.start_time || ""}
                onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                className="w-20 rounded-md border border-slate-200 px-1.5 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="time"
                value={form.end_time || ""}
                onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                className="w-20 rounded-md border border-slate-200 px-1.5 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={saving || !form.title.trim()}
                onClick={submitAdd}
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Check size={12} />
                যোগ করুন
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
