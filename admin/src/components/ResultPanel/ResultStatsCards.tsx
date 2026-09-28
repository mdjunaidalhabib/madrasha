import { Users, CheckCircle2, XCircle, UserX, Award } from "lucide-react";
import { localizeDigits, useIsMadrasa, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";

type GradeItem = {
  id: string | number;
  name: string;
  minMark?: number;
  maxMark?: number;
  min_mark?: number;
  max_mark?: number;
};

interface Props {
  statuses: (string | undefined)[];
  generalGrades?: GradeItem[];
  madrasaGrades?: GradeItem[];
}

const getGradeRange = (grade: GradeItem) => ({
  min: grade.minMark ?? grade.min_mark,
  max: grade.maxMark ?? grade.max_mark,
});

const sortByMinDesc = (grades: GradeItem[]) =>
  [...grades].sort((a, b) => Number(getGradeRange(b).min ?? 0) - Number(getGradeRange(a).min ?? 0));

const formatPercent = (count: number, total: number, lang: Lang) =>
  localizeDigits(total > 0 ? ((count / total) * 100).toFixed(1) : "0.0", lang);

export default function ResultStatsCards({
  statuses,
  generalGrades = [],
  madrasaGrades = [],
}: Props) {
  const lang = useLang();
  const t = useText(resultPanelText).stats;
  const isMadrasa = useIsMadrasa();
  const num = (value: number | string) => localizeDigits(value, lang);
  const total = statuses.length;
  const pass = statuses.filter((s) => String(s || "").toUpperCase() === "PASS").length;
  const fail = statuses.filter((s) => String(s || "").toUpperCase() === "FAIL").length;
  const absent = statuses.filter((s) => String(s || "").toUpperCase() === "ABSENT").length;

  if (total === 0) return null;

  const cards = [
    {
      label: t.totalStudents,
      value: num(total),
      sub: null,
      icon: Users,
      className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400",
    },
    {
      label: t.pass,
      value: num(pass),
      sub: `${formatPercent(pass, total, lang)}%`,
      icon: CheckCircle2,
      className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400",
    },
    {
      label: t.fail,
      value: num(fail),
      sub: `${formatPercent(fail, total, lang)}%`,
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400",
    },
    {
      label: t.absent,
      value: num(absent),
      sub: `${formatPercent(absent, total, lang)}%`,
      icon: UserX,
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
    },
  ];

  const sortedGeneral = sortByMinDesc(generalGrades);
  // Madrasa grades are shown to madrasas only.
  const sortedMadrasa = isMadrasa ? sortByMinDesc(madrasaGrades) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon, className }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm ${className}`}
          >
            <Icon size={22} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium opacity-80">{label}</p>
              <p className="text-lg font-bold leading-tight">
                {value}
                {sub && <span className="ms-1 text-xs font-semibold opacity-80">({sub})</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(sortedGeneral.length > 0 || sortedMadrasa.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Award size={16} />
            <p className="text-xs font-semibold">{t.gradeScale}</p>
          </div>

          <div className="space-y-2">
            {sortedGeneral.length > 0 && <GradeChipRow label={t.general} grades={sortedGeneral} />}
            {sortedMadrasa.length > 0 && <GradeChipRow label={t.madrasa} grades={sortedMadrasa} />}
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapped in its own `overflow-x-auto` as a safety net: `flex-wrap` alone
// should always break long chip rows onto new lines within the available
// width, but this guarantees that even in an edge case (a single chip wider
// than the card) the row scrolls internally instead of being cut off by an
// ancestor's overflow clipping (e.g. the dashboard shell's scroll container).
function GradeChipRow({ label, grades }: { label: string; grades: GradeItem[] }) {
  const lang = useLang();
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}:</span>
        {grades.map((g) => {
          const { min, max } = getGradeRange(g);
          return (
            <span
              key={g.id}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              {g.name} ({localizeDigits(min ?? "-", lang)}-{localizeDigits(max ?? "-", lang)})
            </span>
          );
        })}
      </div>
    </div>
  );
}
