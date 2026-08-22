import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { usePlanStore } from "../../store/planStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const TONE_CLASSES: Record<"green" | "yellow" | "red", string> = {
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  yellow:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
};

export default function PlanBadge() {
  const plan = usePlanStore((s) => s.plan);
  if (!plan) return null;

  const expired = plan.plan_status === "expired" || plan.plan_status === "suspended" || !plan.has_active_subscription;
  const nearExpiry = !expired && plan.days_remaining !== null && plan.days_remaining <= 7;
  const tone: "green" | "yellow" | "red" = expired ? "red" : nearExpiry ? "yellow" : "green";

  const daysLabel =
    plan.days_remaining === null
      ? ""
      : plan.days_remaining < 0
        ? "মেয়াদ শেষ"
        : plan.days_remaining === 0
          ? "আজই শেষ"
          : `${plan.days_remaining} দিন বাকি`;

  const statusLabel = plan.plan_status === "suspended" ? "স্থগিত" : !plan.has_active_subscription ? "সাবস্ক্রিপশন নেই" : "";

  return (
    <Link
      to={`${getTenantAdminBase()}/settings/plan`}
      title="প্ল্যান দেখুন"
      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold transition hover:opacity-80 ${TONE_CLASSES[tone]}`}
    >
      <Crown size={13} className="shrink-0" />
      <span className="hidden max-w-[110px] truncate sm:inline">
        {plan.plan_name || "প্ল্যান"}
      </span>
      <span className="shrink-0 whitespace-nowrap">{statusLabel || daysLabel}</span>
    </Link>
  );
}
