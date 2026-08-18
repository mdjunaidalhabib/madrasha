import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toBanglaDigits } from "../../utils/reportUtils";

type ExamItem = {
  id: number | string;
  examDate: string;
  examName: string;
  className?: string;
  subject?: string;
  startTime?: string;
  endTime?: string;
};

type Props = {
  exams: ExamItem[];
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

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function EventCalendar({ exams }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dateKey(today));

  const examsByDate = useMemo(() => {
    const map = new Map<string, ExamItem[]>();
    for (const exam of exams || []) {
      const key = dateKey(new Date(exam.examDate));
      const list = map.get(key) || [];
      list.push(exam);
      map.set(key, list);
    }
    return map;
  }, [exams]);

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

  const selectedExams = examsByDate.get(selected) || [];

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
          const dayExams = examsByDate.get(key);

          return (
            <div key={i} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setSelected(key)}
                className={`relative flex h-7 w-7 flex-col items-center justify-center rounded-full text-xs transition ${
                  isSelected
                    ? "bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-600/30"
                    : isToday
                      ? "border-2 border-indigo-400 font-semibold text-indigo-600 dark:text-indigo-400"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {toBanglaDigits(date.getDate())}
                {dayExams?.length ? (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`}
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {selectedExams.length ? "এই দিনের পরীক্ষা" : "এই দিনে কোনো পরীক্ষা নেই"}
        </p>
        {selectedExams.length > 0 && (
          <ul className="space-y-2">
            {selectedExams.map((exam) => (
              <li key={exam.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                  {exam.examName}
                  {exam.className ? ` · ${exam.className}` : ""}
                </span>
                <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                  {exam.startTime} - {exam.endTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
