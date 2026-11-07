import { Link } from "react-router-dom";
import { isPlanSuspended } from "../../services/planApi";
import { usePlanStore } from "../../store/planStore";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "./shell.text";

const TONE_CLASSES: Record<"green" | "yellow" | "red", string> = {
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  yellow:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
};

// The existing authenticated Settings, Plan route remains the access boundary.
export default function PlanBadge() {
  const plan = usePlanStore((s) => s.plan);
  const t = useText(shellText);
  const lang = useLang();
  if (!plan) return null;

  const expired = isPlanSuspended(plan);
  const nearExpiry = !expired && plan.days_remaining !== null && plan.days_remaining <= 7;
  const tone: "green" | "yellow" | "red" = expired
    ? "red"
    : nearExpiry || plan.over_limit
      ? "yellow"
      : "green";
  const name = plan.plan_name_bn || plan.plan_name || t.noSubscription;

  const daysLabel =
    plan.days_remaining === null
      ? ""
      : plan.days_remaining < 0
        ? t.expired
        : plan.days_remaining === 0
          ? t.endsToday
          : t.daysLeft(localizeDigits(plan.days_remaining, lang));

  const statusLabel =
    plan.plan_status === "suspended"
      ? t.suspended
      : !plan.has_active_subscription
        ? t.noSubscription
        : "";

  return (
    <Link
      to={`/settings/plan`}
      title={`${t.planTitle(name)} ${statusLabel || daysLabel}${plan.over_limit ? ` · ${t.overLimit}` : ""}`.trim()}
      aria-label={`${t.planStatus}: ${name}, ${expired ? t.expired : plan.over_limit ? t.overLimit : daysLabel || t.active}`}
      className={`flex h-8 max-w-[9rem] shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold transition hover:opacity-80 sm:max-w-[12rem] ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${tone === "red" ? "bg-rose-500" : tone === "yellow" ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      <span className="truncate">{name}</span>
    </Link>
  );
}
