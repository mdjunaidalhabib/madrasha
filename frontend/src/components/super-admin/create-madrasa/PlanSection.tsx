import { Plan } from "../../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";

type Props = {
  plans: Plan[];
  plan_id: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  locked: boolean;
  onPlanChange: (id: string) => void;
};

export default function PlanSection({
  plans,
  plan_id,
  student_limit,
  user_limit,
  duration_days,
  locked,
  onPlanChange,
}: Props) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700 dark:text-slate-200">Plan & Limits</h4>

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
      <LimitField label="Duration (Days)" value={duration_days} disabled={locked} />
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
