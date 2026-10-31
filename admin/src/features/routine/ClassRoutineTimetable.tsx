import { Plus, Trash2, UserRound } from "lucide-react";
import { localizeDigits, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { routineText } from "./routine.text";

type PeriodRow = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher?: { nameBn?: string } | null;
};

export default function ClassRoutineTimetable({ rows, printable = false, onRemove, onChooseSlot }: {
  rows: PeriodRow[];
  printable?: boolean;
  onRemove?: (id: number) => void;
  onChooseSlot?: (day: number, startTime: string, endTime: string) => void;
}) {
  const uiText = useText(routineText);
  const printText = usePrintText(routineText);
  const t = printable ? printText : uiText;
  const periods = [...new Map(rows.map((row) => [
    `${row.startTime}-${row.endTime}`, { start: row.startTime, end: row.endTime },
  ])).values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  // Offer eight periods while preserving all saved lessons and custom times.
  for (let index = 0; index < 8 && periods.length < 8; index++) {
    const start = 8 * 60 + index * 50 + (index >= 3 ? 20 : 0);
    const candidate = { start: clock(start), end: clock(start + 40) };
    if (!periods.some((period) => candidate.start < period.end && period.start < candidate.end)) periods.push(candidate);
  }
  periods.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  while (periods.length < 8) {
    const last = periods[periods.length - 1];
    const [hours, minutes] = last.end.split(":").map(Number);
    const start = hours * 60 + minutes + 10;
    if (start + 40 >= 24 * 60) break;
    periods.push({ start: clock(start), end: clock(start + 40) });
  }
  const days = [6, 0, 1, 2, 3, 4, ...(rows.some((row) => row.dayOfWeek === 5) ? [5] : [])];
  const cells = new Map<string, PeriodRow[]>();
  for (const row of rows) {
    const key = `${row.dayOfWeek}-${row.startTime}-${row.endTime}`;
    cells.set(key, [...(cells.get(key) ?? []), row]);
  }
  const border = printable ? "border border-black" : "border border-slate-200 dark:border-slate-700";

  return (
    <div className={printable ? "w-full" : "overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"}>
      <table aria-label={t.periodTimetable} className={`w-full border-collapse text-center ${printable ? "table-fixed text-sm text-black" : "min-w-[640px] text-sm"}`}>
        <thead>
          <tr>
            <th scope="col" className={`${border} px-2 py-3 font-semibold ${printable ? "w-24" : "sticky left-0 z-10 w-28 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{t.day}</th>
            {periods.map((period, index) => (
              <th scope="col" key={`${period.start}-${period.end}`} className={`${border} px-2 py-3 font-medium ${printable ? "" : "min-w-36 bg-blue-50/70 dark:bg-blue-950/30"}`}>
                <span className={`block font-semibold ${printable ? "" : "text-blue-700 dark:text-blue-300"}`}>{t.period} {localizeDigits(index + 1, "bn")}</span>
                <span className={`mt-1 block whitespace-nowrap text-xs ${printable ? "" : "text-slate-500 dark:text-slate-400"}`}>{localizeDigits(`${period.start}–${period.end}`, "bn")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <th scope="row" className={`${border} px-2 py-4 font-semibold ${printable ? "" : "sticky left-0 z-10 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{routineText.bn.days[day]}</th>
              {periods.map((period) => {
                const lessons = cells.get(`${day}-${period.start}-${period.end}`) ?? [];
                return (
                  <td key={`${period.start}-${period.end}`} className={`${border} p-2 align-middle ${printable ? "" : "bg-white dark:bg-slate-900"}`}>
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className={printable ? "py-1" : "group relative rounded-lg bg-blue-50/50 px-2 py-3 dark:bg-slate-800/70"}>
                        <p className={`break-words font-semibold ${printable ? "" : "text-slate-800 dark:text-slate-100"}`}>{lesson.subject}</p>
                        {lesson.teacher?.nameBn?.trim() && <p className={`mt-1 flex items-center justify-center gap-1 text-xs ${printable ? "" : "text-slate-500 dark:text-slate-400"}`}>{!printable && <UserRound size={12} />}{lesson.teacher.nameBn}</p>}
                        {!printable && onRemove && <button type="button" aria-label={`${t.removePeriod}: ${routineText.bn.days[day]}, ${lesson.subject}, ${period.start}`} onClick={() => onRemove(lesson.id)} className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-rose-950/40"><Trash2 size={13} /></button>}
                      </div>
                    ))}
                    {!lessons.length && !printable && onChooseSlot && <button type="button" aria-label={`${t.addPeriod}: ${routineText.bn.days[day]}, ${period.start}`} onClick={() => onChooseSlot(day, period.start, period.end)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:hover:bg-blue-950"><Plus size={16} /></button>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
