import { Plan } from "../../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";

/** One বিভাগ's share of the registration-number blocks a new madrasa gets. */
export type RegBlockPreviewRow = {
  label: string;
  classCount: number;
  /** Plan's block size per class for this বিভাগ (0 = no automatic block). */
  size: number;
  start: number | null;
  end: number | null;
};

const bn = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

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
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700 dark:text-slate-200">Plan & Limits</h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">Plan</label>
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

        <LimitField label="Student Limit" value={student_limit} disabled={locked} />
        <LimitField label="User Limit" value={user_limit} disabled={locked} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">
            Plan Start Date
          </label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={start_date}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        <LimitField label="Duration (Days)" value={duration_days} disabled={locked} />
      </div>

      <p className="-mt-2 text-xs text-gray-400 dark:text-slate-500">
        এই মাদ্রাসা আগে থেকেই সাবস্ক্রিপশন ব্যবহার করে থাকলে প্রকৃত শুরুর তারিখ দিন, নাহলে আজকের তারিখ থাকবে।
      </p>

      {regBlockPreview.length > 0 && (
        <div className="rounded-lg border dark:border-slate-700">
          <div className="border-b px-3 py-2 dark:border-slate-700">
            <div className="text-sm font-medium text-gray-700 dark:text-slate-200">রেজি. নম্বর ব্লক (প্ল্যান অনুযায়ী)</div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              তৈরির সময় প্রতিটি শ্রেণি নিচের সাইজের ব্লক পাবে, পরপর সাজানো। পরে মাদ্রাসার অ্যাডমিন কম-বেশি করতে পারবেন।
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">বিভাগ</th>
                  <th className="px-3 py-2 font-medium">প্রতি শ্রেণি</th>
                  <th className="px-3 py-2 font-medium">শ্রেণি</th>
                  <th className="px-3 py-2 font-medium">নম্বর</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {regBlockPreview.map((row) => (
                  <tr key={row.label} className="text-gray-700 dark:text-slate-300">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {row.size ? bn(row.size) : <span className="font-normal text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{bn(row.classCount)}টি</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.start != null && row.end != null ? (
                        `${bn(row.start)}–${bn(row.end)}`
                      ) : (
                        <span className="text-xs text-gray-400">অটো ব্লক নেই</span>
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
