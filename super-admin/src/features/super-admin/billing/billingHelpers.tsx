export function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const cls =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
        : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400";
  const label = status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Pending";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function TypeBadge({ type }: { type: "PACKAGE" | "RECHARGE" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        type === "PACKAGE"
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      ].join(" ")}
    >
      {type === "PACKAGE" ? "Package" : "Recharge"}
    </span>
  );
}

export function fmtMoney(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

export function fmtInt(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-BD");
}

// allow digits + one dot, max 2 decimals
export function sanitizeDecimalText(input: string) {
  const cleaned = input.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const intPart = (parts[0] || "0").replace(/^0+(?=\d)/, "");
  if (parts.length === 1) return intPart || "0";
  const dec = (parts[1] || "").replace(/[^\d]/g, "").slice(0, 2);
  return `${intPart || "0"}.${dec}`;
}

export function IconButton({
  children,
  onClick,
  title,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  variant?: "default" | "danger" | "warn";
}) {
  const cls =
    variant === "danger"
      ? "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
      : variant === "warn"
        ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/40"
        : "rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">{hint}</div>}
    </div>
  );
}
