import { Plan } from "../../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { createMadrasaText } from "./createMadrasa.text";

/** One বিভাগ's share of the registration-number blocks a new madrasa gets. */
export type RegBlockPreviewRow = {
  label: string;
  classCount: number;
  /** Plan's block size per class for this বিভাগ (0 = no automatic block). */
  size: number;
  start: number | null;
  end: number | null;
};

type Props = {
  plans: Plan[];
  plan_id: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  start_date: string;
  locked: boolean;
  onPlanChange: (id: string) => void;
  onStartDateChange: (value: string) => void;
  regBlockPreview?: RegBlockPreviewRow[];
};

export default function PlanSection({
  plans,
  plan_id,
  student_limit,
  user_limit,
  duration_days,
  start_date,
  locked,
  onPlanChange,
  onStartDateChange,
  regBlockPreview = [],
}: Props) {
  const t = useText(createMadrasaText);
  const lang = useLang();
  const bn = (n: number) => localizeDigits(n, lang);
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700 dark:text-slate-200">{t.planAndLimits}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">{t.plan}</label>
          <select
            className="w-full border rounded px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={plan_id}
            onChange={(e) => onPlanChange(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <LimitField label={t.studentLimit} value={student_limit} disabled={locked} />
        <LimitField label={t.userLimit} value={user_limit} disabled={locked} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">
            {t.planStartDate}
          </label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={start_date}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        <LimitField label={t.durationDays} value={duration_days} disabled={locked} />
      </div>

      <p className="-mt-2 text-xs text-gray-400 dark:text-slate-500">
        {t.startDateHint}
      </p>

      {regBlockPreview.length > 0 && (
        <div className="rounded-lg border dark:border-slate-700">
          <div className="border-b px-3 py-2 dark:border-slate-700">
            <div className="text-sm font-medium text-gray-700 dark:text-slate-200">{t.regBlockTitle}</div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {t.regBlockHint}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-start text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.colDivision}</th>
                  <th className="px-3 py-2 font-medium">{t.colPerClass}</th>
                  <th className="px-3 py-2 font-medium">{t.colClasses}</th>
                  <th className="px-3 py-2 font-medium">{t.colNumbers}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {regBlockPreview.map((row) => (
                  <tr key={row.label} className="text-gray-700 dark:text-slate-300">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {row.size ? bn(row.size) : <span className="font-normal text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{t.classCount(bn(row.classCount))}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.start != null && row.end != null ? (
                        `${bn(row.start)}–${bn(row.end)}`
                      ) : (
                        <span className="text-xs text-gray-400">{t.noAutoBlock}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LimitField({ label, value, disabled }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">{label}</label>
      <input
        type="number"
        value={value}
        disabled={disabled}
        readOnly={disabled}
        className="w-full border rounded px-3 py-2 bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}
